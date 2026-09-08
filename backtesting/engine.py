"""
Backtesting Engine: simulates a long-only strategy over historical daily
OHLCV + indicator data, one position at a time, with an ATR-based stop
loss and target so exits aren't purely signal-driven.
"""
from typing import Dict, Any, List
import pandas as pd

from backtesting.strategy import BaseStrategy
from backtesting.metrics import BacktestMetrics


class BacktestEngine:
    def __init__(
        self,
        data: pd.DataFrame,
        strategy: BaseStrategy,
        initial_capital: float = 100000.0,
        stop_loss_atr_mult: float = 2.0,
        target_atr_mult: float = 4.0,
    ):
        self.data = data
        self.strategy = strategy
        self.initial_capital = initial_capital
        self.stop_loss_atr_mult = stop_loss_atr_mult
        self.target_atr_mult = target_atr_mult

    def run(self) -> Dict[str, Any]:
        df = self.data
        signals = self.strategy.generate_signals(df)

        cash = self.initial_capital
        shares = 0.0
        entry_price = None
        entry_date = None
        stop_price = None
        target_price = None

        equity_curve: List[float] = []
        equity_dates: List[str] = []
        trades: List[Dict[str, Any]] = []

        for date, row in df.iterrows():
            close = float(row["Close"])
            atr = float(row["ATR_14"]) if "ATR_14" in row and pd.notna(row["ATR_14"]) else close * 0.02
            signal = signals.loc[date]
            date_str = date.strftime("%Y-%m-%d") if hasattr(date, "strftime") else str(date)

            if shares > 0:
                hit_stop = close <= stop_price
                hit_target = close >= target_price
                should_exit = signal == "SELL" or hit_stop or hit_target

                if should_exit:
                    proceeds = shares * close
                    cash += proceeds
                    pnl_pct = round(((close - entry_price) / entry_price) * 100.0, 2)
                    trades.append({
                        "entry_date": entry_date,
                        "exit_date": date_str,
                        "entry_price": round(entry_price, 2),
                        "exit_price": round(close, 2),
                        "pnl_pct": pnl_pct,
                        "exit_reason": "Stop Loss" if hit_stop else ("Target Hit" if hit_target else "Signal Exit"),
                    })
                    shares = 0.0
                    entry_price = None
                    entry_date = None
                    stop_price = None
                    target_price = None

            elif signal == "BUY" and cash > 0:
                shares = cash / close
                cash = 0.0
                entry_price = close
                entry_date = date_str
                stop_price = close - (atr * self.stop_loss_atr_mult)
                target_price = close + (atr * self.target_atr_mult)

            portfolio_value = cash + (shares * close)
            equity_curve.append(portfolio_value)
            equity_dates.append(date_str)

        equity_series = pd.Series(equity_curve, index=pd.to_datetime(equity_dates))

        # Mark-to-market an open position at the end of the run so metrics
        # reflect it, without adding a synthetic closed trade to the log.
        if shares > 0:
            last_close = float(df["Close"].iloc[-1])
            open_pnl_pct = round(((last_close - entry_price) / entry_price) * 100.0, 2)
        else:
            open_pnl_pct = None

        metrics = BacktestMetrics.summarize(equity_series, trades, self.initial_capital)

        return {
            "strategy_name": self.strategy.name,
            "initial_capital": self.initial_capital,
            "equity_curve": [{"date": d, "value": round(v, 2)} for d, v in zip(equity_dates, equity_curve)],
            "trades": trades,
            "open_position": (
                {"entry_date": entry_date, "entry_price": round(entry_price, 2), "unrealized_pnl_pct": open_pnl_pct}
                if shares > 0 else None
            ),
            "metrics": metrics,
        }
