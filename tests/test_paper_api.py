"""
/paper/* endpoints and the bot tick, with quotes, signals and the clock
monkeypatched - no network, and the real background thread never starts
(create_app() defaults to run_paper_bot=False).
"""
from datetime import datetime, timedelta

import pytest
import pytz
from fastapi.testclient import TestClient

from api import paper_bot, paper_store, user_data_store
from api.api import create_app
from api.auth import create_access_token
from config.settings import settings

IST = pytz.timezone("Asia/Kolkata")
OPEN = IST.localize(datetime(2026, 10, 20, 11, 0))      # Tuesday 11:00
CLOSED = IST.localize(datetime(2026, 10, 20, 18, 0))    # Tuesday 18:00


class Market:
    def __init__(self):
        self.now = OPEN
        self.prices = {"TCS.NS": 3500.0, "SBIN.NS": 1000.0, "INFY.NS": 1500.0}
        self.signals = {}


@pytest.fixture
def market(monkeypatch, tmp_path):
    m = Market()
    monkeypatch.setattr(settings, "DATABASE_URL", "")
    monkeypatch.setattr(user_data_store, "_DATA_DIR", str(tmp_path / "user_data"))
    monkeypatch.setattr(paper_store, "market_now", lambda: m.now)

    def quote(ticker):
        price = m.prices.get(ticker)
        return {"ticker": ticker, "price": price} if price else None

    monkeypatch.setattr(paper_bot, "get_quote", quote)
    monkeypatch.setattr(paper_bot, "get_signal", lambda t: m.signals.get(t, {"signal_type": "WAIT"}))
    monkeypatch.setattr(paper_bot, "company_name_for", lambda t: f"{t} Ltd")
    return m


def client_for(username="alice"):
    client = TestClient(create_app())
    client.headers["Authorization"] = f"Bearer {create_access_token(username)}"
    return client


def buy(client, ticker="TCS.NS", qty=10, **extra):
    return client.post("/paper/orders", json={"ticker": ticker, "side": "BUY", "quantity": qty, **extra})


def test_requires_login(market):
    client = TestClient(create_app())
    client.headers.pop("Authorization", None)
    assert client.get("/paper/account").status_code == 401


def test_fresh_account(market):
    body = client_for().get("/paper/account").json()
    assert body["market_open"] is True
    assert body["summary"]["cash"] == 1_000_000.0
    assert body["summary"]["equity"] == 1_000_000.0
    assert body["positions"] == []
    assert body["bot"]["enabled"] is False


def test_buy_then_account_shows_live_pnl(market):
    c = client_for()
    r = buy(c, "tcs", 10, target=3800, stop=3400)
    assert r.status_code == 200, r.text
    assert r.json()["trade"]["ticker"] == "TCS.NS"
    market.prices["TCS.NS"] = 3600.0
    body = c.get("/paper/account").json()
    pos = body["positions"][0]
    assert pos["quantity"] == 10 and pos["price"] == 3600.0
    assert pos["unrealized_pnl"] == 1000.0
    assert pos["company_name"] == "TCS.NS Ltd"
    assert body["summary"]["cash"] == 965_000.0
    assert body["summary"]["total_pnl"] == 1000.0


def test_accounts_are_per_user(market):
    buy(client_for("alice"))
    assert client_for("bob").get("/paper/account").json()["positions"] == []


def test_orders_rejected_when_market_closed(market):
    market.now = CLOSED
    r = buy(client_for())
    assert r.status_code == 400
    assert "market is closed" in r.json()["detail"]


def test_order_rejected_without_live_price(market):
    r = buy(client_for(), "NOPE.NS")
    assert r.status_code == 400
    assert "live price" in r.json()["detail"]


def test_rule_errors_are_400_with_message(market):
    c = client_for()
    r = buy(c, "TCS.NS", 1000)
    assert r.status_code == 400 and "Not enough cash" in r.json()["detail"]
    r = c.post("/paper/orders", json={"ticker": "TCS.NS", "side": "SELL", "quantity": 1})
    assert r.status_code == 400 and "don't hold" in r.json()["detail"]
    assert c.get("/paper/account").json()["summary"]["cash"] == 1_000_000.0


def test_cannot_buy_as_bot(market):
    r = buy(client_for(), owner="BOT")
    assert r.status_code == 400


def test_account_load_runs_catch_up_exits(market):
    c = client_for()
    buy(c, "TCS.NS", 10, stop=3400)
    market.prices["TCS.NS"] = 3300.0
    body = c.get("/paper/account").json()
    assert body["positions"] == []
    sell = body["recent_trades"][0]
    assert sell["side"] == "SELL" and sell["reason"] == "STOP"
    assert sell["note"]  # 2.9% past the stop


def test_set_levels(market):
    c = client_for()
    buy(c)
    r = c.put("/paper/positions/YOU/TCS.NS/levels", json={"target": 3900, "stop": 3300})
    assert r.status_code == 200, r.text
    assert r.json()["position"]["target"] == 3900
    r = c.put("/paper/positions/YOU/TCS.NS/levels", json={"target": 3000})
    assert r.status_code == 400


def test_history_and_csv(market):
    c = client_for()
    buy(c)
    c.post("/paper/orders", json={"ticker": "TCS.NS", "side": "SELL", "quantity": 4})
    trades = c.get("/paper/history").json()["trades"]
    assert [t["side"] for t in trades] == ["SELL", "BUY"]
    csv = c.get("/paper/history.csv")
    assert csv.status_code == 200
    assert csv.text.splitlines()[0].startswith("time,owner,side,ticker")
    assert len(csv.text.strip().splitlines()) == 3


def test_bot_settings_validation(market):
    c = client_for()
    r = c.put("/paper/bot", json={"enabled": True, "tickers": ["sbin", "SBIN.NS", "tcs"], "max_positions": 2})
    assert r.status_code == 200, r.text
    bot = r.json()["bot"]
    assert bot["enabled"] is True
    assert bot["tickers"] == ["SBIN.NS", "TCS.NS"]
    assert c.put("/paper/bot", json={"max_positions": 0}).status_code == 400
    assert c.put("/paper/bot", json={"budget_per_trade": 5_000_000}).status_code == 400
    assert c.put("/paper/bot", json={"tickers": [f"T{i}" for i in range(16)]}).status_code == 400


def test_client_cannot_overwrite_paper_account_via_generic_sync(market):
    c = client_for()
    r = c.put("/me/data/paper_account", json={"value": {"cash": 99_999_999}})
    assert r.status_code == 403


def test_reset(market):
    c = client_for()
    buy(c)
    c.put("/paper/bot", json={"enabled": True})
    body = c.post("/paper/reset").json()
    assert body["summary"]["cash"] == 1_000_000.0
    assert body["positions"] == [] and body["recent_trades"] == []
    assert body["bot"]["enabled"] is False


# --------------------------------------------------------------------------
# Background tick
# --------------------------------------------------------------------------

def test_tick_runs_bot_and_exits(market):
    c = client_for()
    c.put("/paper/bot", json={"enabled": True, "tickers": ["SBIN.NS", "INFY.NS"]})
    market.signals["SBIN.NS"] = {"signal_type": "BUY_NOW", "target_price": 1100.0, "stop_loss_price": 950.0}

    paper_bot.tick(OPEN)
    body = c.get("/paper/account").json()
    assert [(p["ticker"], p["owner"], p["quantity"]) for p in body["positions"]] == [("SBIN.NS", "BOT", 100)]
    log = c.get("/paper/bot").json()["bot"]["log"]
    assert {e["ticker"]: e["action"] for e in log} == {"SBIN.NS": "BUY", "INFY.NS": "SKIP"}

    # Bot isn't due again for 5 minutes; exits still checked every tick.
    market.prices["SBIN.NS"] = 1105.0
    paper_bot.tick(OPEN + timedelta(minutes=1))
    body = c.get("/paper/account").json()
    assert body["positions"] == []
    assert body["recent_trades"][0]["reason"] == "TARGET"
    assert body["summary"]["realized_pnl"]["BOT"] == 10_500.0
    assert len(c.get("/paper/bot").json()["bot"]["log"]) == 2


def test_tick_does_nothing_when_market_closed(market):
    c = client_for()
    c.put("/paper/bot", json={"enabled": True, "tickers": ["SBIN.NS"]})
    market.signals["SBIN.NS"] = {"signal_type": "BUY_NOW", "target_price": 1100.0, "stop_loss_price": 950.0}
    paper_bot.tick(CLOSED)
    assert c.get("/paper/bot").json()["bot"]["log"] == []


def test_bot_logs_error_when_signal_unavailable(market, monkeypatch):
    c = client_for()
    c.put("/paper/bot", json={"enabled": True, "tickers": ["SBIN.NS"]})
    monkeypatch.setattr(paper_bot, "get_signal", lambda t: None)
    paper_bot.tick(OPEN)
    log = c.get("/paper/bot").json()["bot"]["log"]
    assert log[0]["action"] == "ERROR"
