import logging
from typing import Dict, Any, List
import pandas as pd
from analysis.models.trade_performance import TrackedTradeModel, TradePerformanceSummaryModel

logger = logging.getLogger("AIEquityResearchPlatform")

def evaluate_trade_lifecycle(
    trade_dict: Dict[str, Any],
    current_price: float,
    scores: Any = None
) -> Dict[str, Any]:
    """
    Evaluates an active trade's live metrics, updates profit %, profit ₹, highest profit %, 
    max drawdown %, target progress %, trailing stop loss, and exit recommendation.
    """
    updated = dict(trade_dict)
    entry_price = float(updated["entry_price"])
    target_price = float(updated["target_price"])
    initial_stop = float(updated["initial_stop_loss"])
    curr_trailing_stop = float(updated.get("trailing_stop_loss", initial_stop))

    # 1. Compute Profit metrics
    profit_amount = round(current_price - entry_price, 2)
    profit_pct = round(((current_price - entry_price) / entry_price) * 100.0, 2)

    # Track Peak Profit & Max Drawdown
    highest_profit_pct = max(float(updated.get("highest_profit_pct", 0.0)), profit_pct)
    prev_drawdown = float(updated.get("max_drawdown_pct", 0.0))
    current_drawdown = min(0.0, profit_pct) if profit_pct < 0 else 0.0
    max_drawdown_pct = min(prev_drawdown, current_drawdown)

    # 2. Target Progress % (0 - 100%)
    denom = max(target_price - entry_price, 0.1)
    target_progress_raw = ((current_price - entry_price) / denom) * 100.0
    target_progress_pct = round(min(max(target_progress_raw, 0.0), 100.0), 1)

    # 3. Dynamic Trailing Stop Loss
    # Rules:
    # - If profit >= +2.0%, trail stop loss to entry_price + 50% of profit distance
    # - Else if profit >= +1.0%, trail stop loss to breakeven (entry_price)
    # Stop loss ONLY moves up, never down.
    new_trailing_stop = curr_trailing_stop
    if profit_pct >= 2.0:
        suggested = entry_price + ((current_price - entry_price) * 0.5)
        new_trailing_stop = max(curr_trailing_stop, suggested)
    elif profit_pct >= 1.0:
        new_trailing_stop = max(curr_trailing_stop, entry_price)

    new_trailing_stop = round(new_trailing_stop, 2)

    # 4. Deterministic Exit Rules & Lifecycle Transitions
    status = updated.get("status", "ACTIVE")
    exit_recommendation = "HOLD"
    exit_reason = None

    if current_price <= new_trailing_stop:
        status = "STOP_LOSS_HIT"
        exit_recommendation = "STOP LOSS HIT"
        exit_reason = f"Price ₹{current_price:,.2f} triggered stop loss at ₹{new_trailing_stop:,.2f}."
    elif current_price >= target_price:
        status = "TARGET_HIT"
        exit_recommendation = "TAKE PROFIT"
        exit_reason = f"Target price ₹{target_price:,.2f} reached (+{profit_pct}% gain)."
    elif target_progress_pct >= 85.0:
        status = "TARGET_NEAR"
        exit_recommendation = "TAKE PROFIT"
        exit_reason = f"Trade is within 15% of profit target (Progress: {target_progress_pct}%)."
    else:
        # Check if technical momentum is weakening (if scores provided)
        overall_score = getattr(scores, "overall_score", 70.0) if scores else 70.0
        rec = getattr(scores, "recommendation", "BUY") if scores else "BUY"
        if rec in ["SELL", "AVOID"] or overall_score <= 40.0:
            status = "EXIT_SUGGESTED"
            exit_recommendation = "EXIT NOW"
            exit_reason = "Quantitative technical score deteriorated below threshold (<40)."

    updated.update({
        "current_price": round(current_price, 2),
        "profit_pct": profit_pct,
        "profit_amount": profit_amount,
        "highest_profit_pct": round(highest_profit_pct, 2),
        "max_drawdown_pct": round(max_drawdown_pct, 2),
        "target_progress_pct": target_progress_pct,
        "trailing_stop_loss": new_trailing_stop,
        "status": status,
        "exit_recommendation": exit_recommendation,
        "exit_reason": exit_reason or updated.get("exit_reason")
    })

    return updated


def calculate_performance_summary(trades: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Computes performance dashboard metrics for completed trades.
    """
    closed = [t for t in trades if t.get("status") in ["CLOSED", "TARGET_HIT", "STOP_LOSS_HIT"]]
    total_trades = len(closed)
    if total_trades == 0:
        return {
            "total_trades": 0,
            "winning_trades": 0,
            "losing_trades": 0,
            "win_rate_pct": 0.0,
            "average_gain_pct": 0.0,
            "average_loss_pct": 0.0,
            "largest_win_pct": 0.0,
            "largest_loss_pct": 0.0,
            "average_holding_time": "0 mins"
        }

    wins = [t for t in closed if t.get("profit_pct", 0) > 0]
    losses = [t for t in closed if t.get("profit_pct", 0) <= 0]

    win_count = len(wins)
    loss_count = len(losses)
    win_rate = round((win_count / total_trades) * 100.0, 1)

    avg_gain = round(sum(t.get("profit_pct", 0) for t in wins) / max(win_count, 1), 2)
    avg_loss = round(sum(t.get("profit_pct", 0) for t in losses) / max(loss_count, 1), 2)

    largest_win = round(max((t.get("profit_pct", 0) for t in wins), default=0.0), 2)
    largest_loss = round(min((t.get("profit_pct", 0) for t in losses), default=0.0), 2)

    total_mins = sum(t.get("holding_time_mins", 0) for t in closed)
    avg_mins = int(total_mins / total_trades)

    if avg_mins < 60:
        avg_holding_str = f"{avg_mins} mins"
    elif avg_mins < 1440:
        avg_holding_str = f"{avg_mins // 60}h {avg_mins % 60}m"
    else:
        avg_holding_str = f"{avg_mins // 1440}d {(avg_mins % 1440) // 60}h"

    return {
        "total_trades": total_trades,
        "winning_trades": win_count,
        "losing_trades": loss_count,
        "win_rate_pct": win_rate,
        "average_gain_pct": avg_gain,
        "average_loss_pct": avg_loss,
        "largest_win_pct": largest_win,
        "largest_loss_pct": largest_loss,
        "average_holding_time": avg_holding_str
    }
