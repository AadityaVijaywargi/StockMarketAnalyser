from datetime import datetime, timedelta

import pytest
import pytz

from analysis import paper_trading as pt
from analysis.paper_trading import PaperTradingError

IST = pytz.timezone("Asia/Kolkata")
# A Tuesday, mid-session.
NOW = IST.localize(datetime(2026, 10, 20, 11, 0))


def fresh():
    return pt.new_account(NOW)


def position(acc, ticker, owner="YOU"):
    return pt.find_position(acc, ticker, owner)


# --------------------------------------------------------------------------
# Market hours
# --------------------------------------------------------------------------

def test_market_hours():
    assert pt.is_market_open(IST.localize(datetime(2026, 10, 20, 9, 15)))
    assert pt.is_market_open(IST.localize(datetime(2026, 10, 20, 15, 30)))
    assert not pt.is_market_open(IST.localize(datetime(2026, 10, 20, 9, 14)))
    assert not pt.is_market_open(IST.localize(datetime(2026, 10, 20, 15, 31)))
    # Saturday
    assert not pt.is_market_open(IST.localize(datetime(2026, 10, 24, 11, 0)))


# --------------------------------------------------------------------------
# Buying and selling
# --------------------------------------------------------------------------

def test_new_account_defaults():
    acc = fresh()
    assert acc["cash"] == 1_000_000.0
    assert acc["starting_cash"] == 1_000_000.0
    assert acc["positions"] == []
    assert acc["trades"] == []
    assert acc["bot"]["enabled"] is False
    assert acc["bot"]["budget_per_trade"] == 100_000.0
    assert acc["bot"]["max_positions"] == 5
    assert len(acc["bot"]["tickers"]) == 10


def test_buy_deducts_cash_and_opens_position():
    acc = fresh()
    trade = pt.buy(acc, "TCS.NS", 10, 3500.0, NOW, target=3800.0, stop=3400.0)
    assert acc["cash"] == 1_000_000.0 - 35_000.0
    pos = position(acc, "TCS.NS")
    assert pos["quantity"] == 10
    assert pos["avg_cost"] == 3500.0
    assert pos["target"] == 3800.0
    assert pos["stop"] == 3400.0
    assert trade["side"] == "BUY" and trade["owner"] == "YOU"
    assert trade["value"] == 35_000.0
    assert acc["trades"][0] is trade


def test_buy_into_existing_position_averages_cost_and_keeps_levels():
    acc = fresh()
    pt.buy(acc, "TCS.NS", 10, 3500.0, NOW, target=3800.0, stop=3400.0)
    pt.buy(acc, "TCS.NS", 10, 3600.0, NOW)
    pos = position(acc, "TCS.NS")
    assert pos["quantity"] == 20
    assert pos["avg_cost"] == 3550.0
    assert pos["target"] == 3800.0
    assert pos["stop"] == 3400.0


def test_buy_rejects_insufficient_cash():
    acc = fresh()
    with pytest.raises(PaperTradingError, match="Not enough cash"):
        pt.buy(acc, "MRF.NS", 10, 150_000.0, NOW)
    assert acc["cash"] == 1_000_000.0
    assert acc["positions"] == [] and acc["trades"] == []


@pytest.mark.parametrize("qty", [0, -1, 1.5])
def test_buy_rejects_bad_quantity(qty):
    with pytest.raises(PaperTradingError):
        pt.buy(fresh(), "TCS.NS", qty, 3500.0, NOW)


def test_buy_rejects_levels_on_wrong_side_of_price():
    with pytest.raises(PaperTradingError, match="Target"):
        pt.buy(fresh(), "TCS.NS", 1, 3500.0, NOW, target=3400.0)
    with pytest.raises(PaperTradingError, match="Stop"):
        pt.buy(fresh(), "TCS.NS", 1, 3500.0, NOW, stop=3600.0)


def test_partial_sell_realizes_pnl_on_avg_cost():
    acc = fresh()
    pt.buy(acc, "TCS.NS", 10, 3500.0, NOW)
    trade = pt.sell(acc, "TCS.NS", 4, 3600.0, NOW)
    assert trade["realized_pnl"] == 400.0
    assert trade["reason"] == "MANUAL"
    assert position(acc, "TCS.NS")["quantity"] == 6
    assert acc["cash"] == 1_000_000.0 - 35_000.0 + 14_400.0


def test_full_sell_closes_position():
    acc = fresh()
    pt.buy(acc, "TCS.NS", 10, 3500.0, NOW)
    pt.sell(acc, "TCS.NS", 10, 3400.0, NOW)
    assert position(acc, "TCS.NS") is None
    assert acc["cash"] == 1_000_000.0 - 1_000.0


def test_sell_more_than_held_rejected():
    acc = fresh()
    pt.buy(acc, "TCS.NS", 5, 3500.0, NOW)
    with pytest.raises(PaperTradingError, match="only hold 5"):
        pt.sell(acc, "TCS.NS", 6, 3500.0, NOW)
    with pytest.raises(PaperTradingError, match="don't hold"):
        pt.sell(acc, "INFY.NS", 1, 1500.0, NOW)


def test_you_and_bot_positions_are_isolated():
    acc = fresh()
    pt.buy(acc, "TCS.NS", 5, 3500.0, NOW, owner="YOU")
    pt.buy(acc, "TCS.NS", 7, 3500.0, NOW, owner="BOT", reason="BOT_SIGNAL")
    assert position(acc, "TCS.NS", "YOU")["quantity"] == 5
    assert position(acc, "TCS.NS", "BOT")["quantity"] == 7
    with pytest.raises(PaperTradingError):
        pt.sell(acc, "TCS.NS", 6, 3500.0, NOW, owner="YOU")
    pt.sell(acc, "TCS.NS", 7, 3500.0, NOW, owner="BOT")
    assert position(acc, "TCS.NS", "BOT") is None
    assert position(acc, "TCS.NS", "YOU")["quantity"] == 5


def test_trade_history_is_capped():
    acc = fresh()
    for _ in range(pt.MAX_TRADES + 5):
        pt.buy(acc, "ITC.NS", 1, 1.0, NOW)
    assert len(acc["trades"]) == pt.MAX_TRADES


# --------------------------------------------------------------------------
# Target / stop exits
# --------------------------------------------------------------------------

def test_set_levels_validates_against_price_and_owner():
    acc = fresh()
    pt.buy(acc, "TCS.NS", 1, 3500.0, NOW)
    pt.set_levels(acc, "TCS.NS", "YOU", target=3900.0, stop=None, price=3550.0)
    pos = position(acc, "TCS.NS")
    assert pos["target"] == 3900.0 and pos["stop"] is None
    with pytest.raises(PaperTradingError):
        pt.set_levels(acc, "TCS.NS", "YOU", target=3500.0, stop=None, price=3550.0)
    pt.buy(acc, "INFY.NS", 1, 1500.0, NOW, owner="BOT")
    with pytest.raises(PaperTradingError, match="bot"):
        pt.set_levels(acc, "INFY.NS", "BOT", target=1600.0, stop=None, price=1500.0)


def test_target_exit():
    acc = fresh()
    pt.buy(acc, "TCS.NS", 10, 3500.0, NOW, target=3800.0, stop=3400.0)
    trades = pt.check_exits(acc, {"TCS.NS": 3805.0}, NOW)
    assert len(trades) == 1
    assert trades[0]["reason"] == "TARGET"
    assert trades[0]["price"] == 3805.0
    assert trades[0]["note"] is None
    assert position(acc, "TCS.NS") is None


def test_stop_exit():
    acc = fresh()
    pt.buy(acc, "TCS.NS", 10, 3500.0, NOW, target=3800.0, stop=3400.0)
    trades = pt.check_exits(acc, {"TCS.NS": 3399.0}, NOW)
    assert trades[0]["reason"] == "STOP"
    assert trades[0]["realized_pnl"] == -1010.0


def test_gap_past_stop_is_noted():
    acc = fresh()
    pt.buy(acc, "TCS.NS", 10, 3500.0, NOW, stop=3400.0)
    trades = pt.check_exits(acc, {"TCS.NS": 3200.0}, NOW)
    assert trades[0]["reason"] == "STOP"
    assert "3,400.00" in trades[0]["note"] and "3,200.00" in trades[0]["note"]


def test_no_exit_between_levels_or_without_quote():
    acc = fresh()
    pt.buy(acc, "TCS.NS", 10, 3500.0, NOW, target=3800.0, stop=3400.0)
    pt.buy(acc, "INFY.NS", 10, 1500.0, NOW)  # no levels
    assert pt.check_exits(acc, {"TCS.NS": 3600.0, "INFY.NS": 1.0}, NOW) == []
    assert pt.check_exits(acc, {}, NOW) == []
    assert len(acc["positions"]) == 2


# --------------------------------------------------------------------------
# Bot decisions
# --------------------------------------------------------------------------

BUY_SIGNAL = {"signal_type": "BUY_NOW", "target_price": 1100.0, "stop_loss_price": 950.0}


def bot_account():
    acc = fresh()
    acc["bot"]["enabled"] = True
    return acc


def test_bot_buys_on_buy_signal_with_budget_sizing():
    acc = bot_account()
    result = pt.bot_consider(acc, "SBIN.NS", BUY_SIGNAL, 1000.0, NOW)
    assert result["action"] == "BUY"
    pos = position(acc, "SBIN.NS", "BOT")
    assert pos["quantity"] == 100  # floor(100000 / 1000)
    assert pos["target"] == 1100.0 and pos["stop"] == 950.0
    assert acc["trades"][0]["reason"] == "BOT_SIGNAL"
    assert acc["bot"]["log"][0]["action"] == "BUY"


def test_bot_skips_non_buy_signal():
    acc = bot_account()
    result = pt.bot_consider(acc, "SBIN.NS", {"signal_type": "WAIT"}, 1000.0, NOW)
    assert result["action"] == "SKIP"
    assert acc["positions"] == []
    assert acc["bot"]["log"][0]["action"] == "SKIP"


def test_bot_skips_invalid_levels():
    acc = bot_account()
    bad = dict(BUY_SIGNAL, stop_loss_price=1010.0)
    assert pt.bot_consider(acc, "SBIN.NS", bad, 1000.0, NOW)["action"] == "SKIP"
    missing = dict(BUY_SIGNAL, target_price=None)
    assert pt.bot_consider(acc, "SBIN.NS", missing, 1000.0, NOW)["action"] == "SKIP"


def test_bot_skips_already_held_and_max_positions():
    acc = bot_account()
    acc["bot"]["max_positions"] = 1
    assert pt.bot_consider(acc, "SBIN.NS", BUY_SIGNAL, 1000.0, NOW)["action"] == "BUY"
    assert pt.bot_consider(acc, "SBIN.NS", BUY_SIGNAL, 1000.0, NOW)["action"] == "SKIP"
    assert pt.bot_consider(acc, "ITC.NS", BUY_SIGNAL, 1000.0, NOW)["action"] == "SKIP"
    assert len(acc["positions"]) == 1


def test_bot_ignores_your_positions_when_counting():
    acc = bot_account()
    acc["bot"]["max_positions"] = 1
    pt.buy(acc, "SBIN.NS", 1, 1000.0, NOW, owner="YOU")
    assert pt.bot_consider(acc, "SBIN.NS", BUY_SIGNAL, 1000.0, NOW)["action"] == "BUY"


def test_bot_skips_when_budget_cannot_afford_one_share_or_cash_short():
    acc = bot_account()
    acc["bot"]["budget_per_trade"] = 500.0
    assert pt.bot_consider(acc, "SBIN.NS", BUY_SIGNAL, 1000.0, NOW)["action"] == "SKIP"
    acc = bot_account()
    acc["cash"] = 2_500.0
    result = pt.bot_consider(acc, "SBIN.NS", BUY_SIGNAL, 1000.0, NOW)
    assert result["action"] == "BUY"
    assert position(acc, "SBIN.NS", "BOT")["quantity"] == 2  # capped by cash


def test_bot_does_not_rebuy_same_day_after_selling():
    acc = bot_account()
    pt.bot_consider(acc, "SBIN.NS", BUY_SIGNAL, 1000.0, NOW)
    pt.check_exits(acc, {"SBIN.NS": 940.0}, NOW)
    later = NOW + timedelta(minutes=30)
    assert pt.bot_consider(acc, "SBIN.NS", BUY_SIGNAL, 1000.0, later)["action"] == "SKIP"
    tomorrow = NOW + timedelta(days=1)
    assert pt.bot_consider(acc, "SBIN.NS", BUY_SIGNAL, 1000.0, tomorrow)["action"] == "BUY"


def test_bot_log_is_capped():
    acc = bot_account()
    for _ in range(pt.MAX_BOT_LOG + 10):
        pt.bot_consider(acc, "SBIN.NS", {"signal_type": "WAIT"}, 1000.0, NOW)
    assert len(acc["bot"]["log"]) == pt.MAX_BOT_LOG


# --------------------------------------------------------------------------
# Summary and reset
# --------------------------------------------------------------------------

def test_summary_splits_you_and_bot():
    acc = fresh()
    pt.buy(acc, "TCS.NS", 10, 3500.0, NOW)
    pt.sell(acc, "TCS.NS", 5, 3600.0, NOW)          # YOU realized +500
    pt.buy(acc, "SBIN.NS", 100, 1000.0, NOW, owner="BOT")
    pt.sell(acc, "SBIN.NS", 50, 980.0, NOW, owner="BOT")  # BOT realized -1000
    s = pt.summary(acc, {"TCS.NS": 3700.0, "SBIN.NS": 1010.0})
    assert s["realized_pnl"]["YOU"] == 500.0
    assert s["realized_pnl"]["BOT"] == -1000.0
    assert s["unrealized_pnl"]["YOU"] == 1000.0     # 5 * (3700-3500)
    assert s["unrealized_pnl"]["BOT"] == 500.0      # 50 * (1010-1000)
    assert s["market_value"] == 5 * 3700.0 + 50 * 1010.0
    assert s["equity"] == round(acc["cash"] + s["market_value"], 2)
    assert s["total_pnl"] == round(s["equity"] - 1_000_000.0, 2)
    assert s["wins"]["YOU"] == 1 and s["losses"]["BOT"] == 1


def test_summary_falls_back_to_avg_cost_without_quote():
    acc = fresh()
    pt.buy(acc, "TCS.NS", 10, 3500.0, NOW)
    s = pt.summary(acc, {})
    assert s["market_value"] == 35_000.0
    assert s["unrealized_pnl"]["YOU"] == 0.0


def test_reset_keeps_bot_settings_but_disables_it():
    acc = fresh()
    acc["bot"]["enabled"] = True
    acc["bot"]["tickers"] = ["SBIN.NS"]
    pt.buy(acc, "TCS.NS", 10, 3500.0, NOW)
    new = pt.reset_account(acc, NOW)
    assert new["cash"] == 1_000_000.0
    assert new["positions"] == [] and new["trades"] == []
    assert new["bot"]["enabled"] is False
    assert new["bot"]["tickers"] == ["SBIN.NS"]
