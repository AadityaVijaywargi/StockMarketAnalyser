"""
Backtesting Engine: simulates a long-only strategy over historical daily
OHLCV + indicator data, one position at a time, with an ATR-based stop
loss and target so exits aren't purely signal-driven.

Execution model (chosen to avoid the flattering assumptions that make
backtests look better than live trading):
- Signals are computed from a bar's close, so they're filled at the NEXT
  bar's open - never at the close that produced them.
- Stops and targets are checked against each bar's intraday Low/High. A gap
  through the level fills at the open (the price actually available), and
  if a bar touches both, the stop is assumed to have hit first.
- Every fill pays slippage (price moves against you) and transaction costs
  (brokerage + STT + exchange charges + stamp duty), each as % per side.
"""
from typing import Dict, Any, List, Optional
import pandas as pd

from backtesting.strategy import BaseStrategy
from backtesting.metrics import BacktestMetrics

# Indian equity delivery: STT 0.1% per side dominates; exchange charges,
# stamp duty and GST add a little more. Brokerage is ~0 at discount brokers.
DEFAULT_COST_PCT = 0.1
DEFAULT_SLIPPAGE_PCT = 0.05


class BacktestEngine:
    def __init__(
        self,
        data: pd.DataFrame,
        strategy: BaseStrategy,
        initial_capital: float = 100000.0,
        stop_loss_atr_mult: float = 2.0,
        target_atr_mult: float = 4.0,
        cost_pct: float = DEFAULT_COST_PCT,
        slippage_pct: float = DEFAULT_SLIPPAGE_PCT,
    ):
        self.data = data
        self.strategy = strategy
        self.initial_capital = initial_capital
        self.stop_loss_atr_mult = stop_loss_atr_mult
        self.target_atr_mult = target_atr_mult
        self.cost_rate = cost_pct / 100.0
        self.slippage_rate = slippage_pct / 100.0

    def run(self) -> Dict[str, Any]:
        df = self.data
        signals = self.strategy.generate_signals(df)

        cash = self.initial_capital
        shares = 0.0
        position: Optional[Dict[str, Any]] = None
        pending: Optional[str] = None  # "BUY" / "SELL" order to fill at next open
        total_costs = 0.0

        equity_curve: List[float] = []
        equity_dates: List[str] = []
        trades: List[Dict[str, Any]] = []

        def close_position(fill_price: float, date_str: str, reason: str) -> None:
            nonlocal cash, shares, position, total_costs
            gross = shares * fill_price
            cost = gross * self.cost_rate
            cash += gross - cost
            total_costs += cost
            # Net P/L of the round trip: everything paid in vs. everything received.
            net_pnl_pct = ((gross - cost) - position["capital_in"]) / position["capital_in"] * 100.0
            trades.append({
                "entry_date": position["entry_date"],
                "exit_date": date_str,
                "entry_price": round(position["entry_price"], 2),
                "exit_price": round(fill_price, 2),
                "pnl_pct": round(net_pnl_pct, 2),
                "exit_reason": reason,
            })
            shares = 0.0
            position = None

        prev_atr: Optional[float] = None

        for date, row in df.iterrows():
            open_ = float(row["Open"])
            high = float(row["High"])
            low = float(row["Low"])
            close = float(row["Close"])
            date_str = date.strftime("%Y-%m-%d") if hasattr(date, "strftime") else str(date)

            # 1. Fill yesterday's order at today's open.
            if pending == "BUY" and position is None:
                fill = open_ * (1 + self.slippage_rate)
                capital_in = cash
                cost = capital_in * self.cost_rate / (1 + self.cost_rate)
                shares = (capital_in - cost) / fill
                cash = 0.0
                total_costs += cost
                # Size stop/target off the ATR known when the order was placed.
                atr = prev_atr if prev_atr is not None else fill * 0.02
                position = {
                    "entry_date": date_str,
                    "entry_price": fill,
                    "capital_in": capital_in,
                    "stop": fill - atr * self.stop_loss_atr_mult,
                    "target": fill + atr * self.target_atr_mult,
                }
            elif pending == "SELL" and position is not None:
                close_position(open_ * (1 - self.slippage_rate), date_str, "Signal Exit")
            pending = None

            # 2. Intraday stop / target (including on the entry bar itself).
            if position is not None:
                stop, target = position["stop"], position["target"]
                if low <= stop:
                    level = min(open_, stop)  # gapped below the stop -> filled at the open
                    close_position(level * (1 - self.slippage_rate), date_str, "Stop Loss")
                elif high >= target:
                    level = max(open_, target)
                    close_position(level * (1 - self.slippage_rate), date_str, "Target Hit")

            # 3. Today's close decides tomorrow's order.
            signal = signals.loc[date]
            if position is None and signal == "BUY" and cash > 0:
                pending = "BUY"
            elif position is not None and signal == "SELL":
                pending = "SELL"

            atr_val = row["ATR_14"] if "ATR_14" in row else None
            prev_atr = float(atr_val) if atr_val is not None and pd.notna(atr_val) else None

            equity_curve.append(cash + shares * close)
            equity_dates.append(date_str)

        equity_series = pd.Series(equity_curve, index=pd.to_datetime(equity_dates))

        # Mark-to-market an open position at the end of the run so metrics
        # reflect it, without adding a synthetic closed trade to the log.
        open_position = None
        if position is not None:
            last_close = float(df["Close"].iloc[-1])
            open_position = {
                "entry_date": position["entry_date"],
                "entry_price": round(position["entry_price"], 2),
                "unrealized_pnl_pct": round((last_close - position["entry_price"]) / position["entry_price"] * 100.0, 2),
            }

        metrics = BacktestMetrics.summarize(equity_series, trades, self.initial_capital)
        metrics["total_costs"] = round(total_costs, 2)

        return {
            "strategy_name": self.strategy.name,
            "initial_capital": self.initial_capital,
            "assumptions": {
                "execution": "Signals fill at the next day's open; stops/targets checked against intraday high/low",
                "cost_pct_per_side": round(self.cost_rate * 100.0, 4),
                "slippage_pct_per_side": round(self.slippage_rate * 100.0, 4),
            },
            "equity_curve": [{"date": d, "value": round(v, 2)} for d, v in zip(equity_dates, equity_curve)],
            "trades": trades,
            "open_position": open_position,
            "metrics": metrics,
        }
