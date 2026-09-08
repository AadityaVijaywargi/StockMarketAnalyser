"""
Backtesting Metrics: portfolio analytics computed from a completed run's
equity curve and trade log.
"""
from typing import List, Dict, Any
import numpy as np
import pandas as pd


class BacktestMetrics:
    @staticmethod
    def calculate_sharpe_ratio(daily_returns: pd.Series, risk_free_rate: float = 0.06) -> float:
        """Annualized Sharpe Ratio from a series of daily portfolio returns."""
        if daily_returns is None or len(daily_returns) < 2:
            return 0.0
        excess = daily_returns - (risk_free_rate / 252.0)
        std = excess.std()
        if std == 0 or pd.isna(std):
            return 0.0
        return float(round((excess.mean() / std) * np.sqrt(252), 2))

    @staticmethod
    def calculate_max_drawdown(equity_curve: pd.Series) -> float:
        """Maximum peak-to-trough drawdown, as a negative percentage."""
        if equity_curve is None or len(equity_curve) < 2:
            return 0.0
        running_max = equity_curve.cummax()
        drawdown = (equity_curve - running_max) / running_max
        return float(round(drawdown.min() * 100.0, 2))

    @staticmethod
    def summarize(equity_curve: pd.Series, trades: List[Dict[str, Any]], initial_capital: float) -> Dict[str, Any]:
        final_value = float(equity_curve.iloc[-1]) if len(equity_curve) else initial_capital
        total_return_pct = round(((final_value - initial_capital) / initial_capital) * 100.0, 2)

        daily_returns = equity_curve.pct_change().dropna()
        closed_trades = [t for t in trades if t.get("pnl_pct") is not None]
        wins = [t for t in closed_trades if t["pnl_pct"] > 0]
        losses = [t for t in closed_trades if t["pnl_pct"] <= 0]

        win_rate = round((len(wins) / len(closed_trades)) * 100.0, 1) if closed_trades else 0.0
        avg_win_pct = round(sum(t["pnl_pct"] for t in wins) / len(wins), 2) if wins else 0.0
        avg_loss_pct = round(sum(t["pnl_pct"] for t in losses) / len(losses), 2) if losses else 0.0

        num_days = len(equity_curve)
        years = max(num_days / 252.0, 1e-6)
        cagr = round((((final_value / initial_capital) ** (1.0 / years)) - 1.0) * 100.0, 2) if final_value > 0 else -100.0

        return {
            "final_value": round(final_value, 2),
            "total_return_pct": total_return_pct,
            "cagr_pct": cagr,
            "max_drawdown_pct": BacktestMetrics.calculate_max_drawdown(equity_curve),
            "sharpe_ratio": BacktestMetrics.calculate_sharpe_ratio(daily_returns),
            "total_trades": len(closed_trades),
            "win_rate_pct": win_rate,
            "avg_win_pct": avg_win_pct,
            "avg_loss_pct": avg_loss_pct,
        }
