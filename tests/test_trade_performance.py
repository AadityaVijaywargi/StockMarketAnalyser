import pytest
from analysis.trade_management import evaluate_trade_lifecycle, calculate_performance_summary

def test_trade_lifecycle_profit_and_trailing_stop():
    initial_trade = {
        "id": "trade_1",
        "ticker": "RELIANCE.NS",
        "entry_price": 100.0,
        "current_price": 100.0,
        "target_price": 110.0,
        "initial_stop_loss": 95.0,
        "trailing_stop_loss": 95.0,
        "status": "ACTIVE",
        "profit_pct": 0.0,
        "highest_profit_pct": 0.0,
        "max_drawdown_pct": 0.0,
        "target_progress_pct": 0.0
    }

    # 1. Price moves to 101 (+1% gain) -> Trailing Stop should move to breakeven (100.0)
    updated_1 = evaluate_trade_lifecycle(initial_trade, current_price=101.0)
    assert updated_1["profit_pct"] == 1.0
    assert updated_1["trailing_stop_loss"] == 100.0
    assert updated_1["highest_profit_pct"] == 1.0

    # 2. Price moves to 104 (+4% gain) -> Trailing Stop should move to entry + 50% of gain (102.0)
    updated_2 = evaluate_trade_lifecycle(updated_1, current_price=104.0)
    assert updated_2["profit_pct"] == 4.0
    assert updated_2["trailing_stop_loss"] == 102.0
    assert updated_2["highest_profit_pct"] == 4.0

    # 3. Price drops to 101.5 (triggers trailing stop at 102.0) -> Status should be STOP_LOSS_HIT
    updated_3 = evaluate_trade_lifecycle(updated_2, current_price=101.5)
    assert updated_3["status"] == "STOP_LOSS_HIT"
    assert updated_3["exit_recommendation"] == "STOP LOSS HIT"

def test_trade_lifecycle_target_hit():
    initial_trade = {
        "id": "trade_2",
        "ticker": "TCS.NS",
        "entry_price": 100.0,
        "target_price": 110.0,
        "initial_stop_loss": 95.0,
        "trailing_stop_loss": 95.0,
        "status": "ACTIVE"
    }

    updated = evaluate_trade_lifecycle(initial_trade, current_price=110.5)
    assert updated["status"] == "TARGET_HIT"
    assert updated["exit_recommendation"] == "TAKE PROFIT"

def test_performance_summary_analytics():
    trades = [
        {"status": "CLOSED", "profit_pct": 5.0, "holding_time_mins": 30},
        {"status": "CLOSED", "profit_pct": 10.0, "holding_time_mins": 60},
        {"status": "CLOSED", "profit_pct": -2.0, "holding_time_mins": 45},
    ]

    summary = calculate_performance_summary(trades)
    assert summary["total_trades"] == 3
    assert summary["winning_trades"] == 2
    assert summary["losing_trades"] == 1
    assert summary["win_rate_pct"] == 66.7
    assert summary["average_gain_pct"] == 7.5
    assert summary["average_loss_pct"] == -2.0
    assert summary["largest_win_pct"] == 10.0
    assert summary["largest_loss_pct"] == -2.0
