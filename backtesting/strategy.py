"""
Backtesting Strategy: vectorized trend/momentum signal generation.
Computes entry/exit signals for an entire historical series in one pass
(standard backtesting practice), using only backward-looking indicator
values so no row's signal depends on future data.
"""
import pandas as pd


class BaseStrategy:
    name: str = "Base"

    def generate_signals(self, df: pd.DataFrame) -> pd.Series:
        """Returns a Series of 'BUY', 'SELL', or 'HOLD' aligned to df's index."""
        raise NotImplementedError


class TrendMomentumStrategy(BaseStrategy):
    """
    Long-only trend-following strategy:
    - Enter when price reclaims the 50-day SMA while the 50/200 SMA
      structure is bullish (SMA_50 > SMA_200) and RSI is out of
      overbought/oversold extremes (40-70), confirming a healthy pullback
      entry rather than a blow-off top or a falling knife.
    - Exit when price closes back below the 50-day SMA, or RSI pushes
      into overbought territory (>75) signalling exhaustion.
    """
    name = "Trend + Momentum (SMA50/200, RSI14)"

    def __init__(self, rsi_low: float = 40.0, rsi_high: float = 70.0, rsi_exit: float = 75.0):
        self.rsi_low = rsi_low
        self.rsi_high = rsi_high
        self.rsi_exit = rsi_exit

    def generate_signals(self, df: pd.DataFrame) -> pd.Series:
        close = df["Close"]
        sma_50 = df["SMA_50"]
        sma_200 = df["SMA_200"]
        rsi = df["RSI_14"]

        bullish_regime = sma_50 > sma_200
        reclaimed_sma50 = (close > sma_50) & (close.shift(1) <= sma_50.shift(1))
        healthy_rsi = (rsi >= self.rsi_low) & (rsi <= self.rsi_high)
        entry = bullish_regime & reclaimed_sma50 & healthy_rsi

        lost_sma50 = (close < sma_50) & (close.shift(1) >= sma_50.shift(1))
        overbought_exit = rsi > self.rsi_exit
        exit_signal = lost_sma50 | overbought_exit

        signals = pd.Series("HOLD", index=df.index)
        signals[entry] = "BUY"
        signals[exit_signal] = "SELL"
        return signals


class MeanReversionStrategy(BaseStrategy):
    """
    Long-only mean-reversion strategy (the opposite archetype from
    TrendMomentumStrategy - buys weakness instead of strength):
    - Enter when price closes below the lower Bollinger Band (20, 2std)
      while RSI confirms oversold conditions, betting on a snap-back
      toward the mean rather than continuation.
    - Exit when price reverts back to the middle band (the mean itself)
      or RSI pushes into overbought territory, taking the reversion gain
      rather than holding for a trend that this strategy isn't designed
      to capture.
    """
    name = "Mean Reversion (Bollinger Bands 20, RSI14)"

    def __init__(self, rsi_oversold: float = 35.0, rsi_overbought: float = 65.0):
        self.rsi_oversold = rsi_oversold
        self.rsi_overbought = rsi_overbought

    def generate_signals(self, df: pd.DataFrame) -> pd.Series:
        close = df["Close"]
        bb_lower = df["BB_Lower_20"]
        bb_middle = df["BB_Middle_20"]
        rsi = df["RSI_14"]

        entry = (close < bb_lower) & (rsi < self.rsi_oversold)
        exit_signal = (close >= bb_middle) | (rsi > self.rsi_overbought)

        signals = pd.Series("HOLD", index=df.index)
        signals[entry] = "BUY"
        signals[exit_signal] = "SELL"
        return signals
