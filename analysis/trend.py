import logging
from typing import Dict, Any, List
import numpy as np
import pandas as pd
from config.settings import settings

logger = logging.getLogger("AIEquityResearchPlatform")

class TimeframeAnalysis:
    """
    Model wrapper representing trend engine outputs for a specific horizon.
    """
    def __init__(
        self,
        timeframe: str,
        direction: str,
        strength: float,
        momentum: float,
        volatility: float,
        liquidity: float,
        buying_pressure: float,
        selling_pressure: float
    ):
        self.timeframe = timeframe
        self.direction = direction
        self.strength = strength
        self.momentum = momentum
        self.volatility = volatility
        self.liquidity = liquidity
        self.buying_pressure = buying_pressure
        self.selling_pressure = selling_pressure

    def to_dict(self) -> Dict[str, Any]:
        return {
            "timeframe": self.timeframe,
            "trend": self.direction,
            "trend_strength": self.strength,
            "momentum": "BULLISH" if self.momentum > 60 else "BEARISH" if self.momentum < 40 else "NEUTRAL",
            "volatility": self.volatility,
            "liquidity": self.liquidity,
            "buying_pressure": self.buying_pressure,
            "selling_pressure": self.selling_pressure
        }


def analyze_horizon_trend(df_slice: pd.DataFrame, timeframe_name: str) -> TimeframeAnalysis:
    """
    Analyzes trend direction, strength, momentum, volatility, and order book pressures on a DataFrame slice.
    """
    if len(df_slice) < 5:
        # Fallback for very short data
        return TimeframeAnalysis(
            timeframe=timeframe_name,
            direction="SIDEWAYS",
            strength=0.0,
            momentum=50.0,
            volatility=0.0,
            liquidity=0.0,
            buying_pressure=50.0,
            selling_pressure=50.0
        )

    close = df_slice["Close"].values
    high = df_slice["High"].values
    low = df_slice["Low"].values
    volume = df_slice["Volume"].values
    
    # 1. Linear Regression for Trend Direction and Strength (R-squared)
    x = np.arange(len(close))
    slope, intercept = np.polyfit(x, close, 1)
    
    # Compute R-squared (Trend Strength)
    y_pred = slope * x + intercept
    y_mean = np.mean(close)
    ss_tot = np.sum((close - y_mean) ** 2)
    ss_res = np.sum((close - y_pred) ** 2)
    
    r_squared = 1.0 - (ss_res / ss_tot) if ss_tot > 0 else 0.0
    trend_strength = round(r_squared * 100.0, 2)
    
    # Define direction
    # Normalise slope by average price to get a daily percentage change
    normalized_slope = slope / y_mean
    if normalized_slope > 0.0005: # > 0.05% daily rise
        direction = "BULLISH"
    elif normalized_slope < -0.0005: # > 0.05% daily drop
        direction = "BEARISH"
    else:
        direction = "SIDEWAYS"
        # Sideways markets have lower trend strength
        trend_strength = round(trend_strength * 0.5, 2)

    # 2. Momentum Strength (based on RSI if in DataFrame, otherwise rate of change)
    # Search for an RSI column in the slice, otherwise calculate a standard 14-day RSI
    rsi_cols = [col for col in df_slice.columns if col.startswith("RSI_")]
    if rsi_cols:
        momentum_score = float(df_slice[rsi_cols[0]].iloc[-1])
    else:
        # Fallback: percentage price change normalized to [0, 100]
        pct_change = (close[-1] - close[0]) / close[0]
        momentum_score = round(min(max(50.0 + (pct_change * 100.0), 0.0), 100.0), 2)
        
    if np.isnan(momentum_score):
        momentum_score = 50.0

    # 3. Volatility (Annualized Volatility of Daily Returns)
    returns = df_slice["Close"].pct_change().dropna().values
    if len(returns) > 1:
        volatility = float(np.std(returns) * np.sqrt(252) * 100.0)
    else:
        volatility = 0.0
    volatility = round(volatility, 2)

    # 4. Liquidity (Average Volume)
    liquidity = float(np.mean(volume))

    # 5. Buying vs Selling Pressure (candlestick wick analysis)
    # Buying pressure: distance from low to close
    # Selling pressure: distance from high to close
    buy_pressure = np.sum(close - low)
    sell_pressure = np.sum(high - close)
    total_pressure = buy_pressure + sell_pressure
    
    if total_pressure > 0:
        buying_pressure_pct = round((buy_pressure / total_pressure) * 100.0, 2)
        selling_pressure_pct = round((sell_pressure / total_pressure) * 100.0, 2)
    else:
        buying_pressure_pct = 50.0
        selling_pressure_pct = 50.0

    return TimeframeAnalysis(
        timeframe=timeframe_name,
        direction=direction,
        strength=trend_strength,
        momentum=momentum_score,
        volatility=volatility,
        liquidity=liquidity,
        buying_pressure=buying_pressure_pct,
        selling_pressure=selling_pressure_pct
    )


def run_trend_engine(df: pd.DataFrame) -> Dict[str, TimeframeAnalysis]:
    """
    Runs multi-horizon trend engine on the stock's Feature Store DataFrame.
    Windows analyzed:
    - 1M (21 trading days)
    - 3M (63 trading days)
    - 6M (126 trading days)
    - 1Y (252 trading days)
    - LONG (Full DataFrame length)
    """
    if df.empty:
        return {}

    n = len(df)
    horizons = {
        "1M": min(n, 21),
        "3M": min(n, 63),
        "6M": min(n, 126),
        "1Y": min(n, 252),
        "LONG": n
    }
    
    results = {}
    for name, length in horizons.items():
        # Get the latest slice of length
        df_slice = df.iloc[-length:]
        results[name] = analyze_horizon_trend(df_slice, name)
        
    return results
