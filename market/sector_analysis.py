import logging
from typing import Dict, Any, Tuple, List
import numpy as np
import pandas as pd
from analysis.trend import analyze_horizon_trend
from config.settings import settings

logger = logging.getLogger("AIEquityResearchPlatform")

def calculate_beta_correlation(stock_df: pd.DataFrame, nifty_df: pd.DataFrame) -> Tuple[float, float]:
    """
    Calculates the stock's beta and Pearson correlation coefficient relative to Nifty 50.
    """
    if stock_df.empty or nifty_df.empty:
        return 1.0, 1.0

    # Align dates by performing inner join on daily percentage returns
    stock_returns = stock_df["Close"].pct_change().dropna()
    nifty_returns = nifty_df["Close"].pct_change().dropna()
    
    stock_returns = stock_returns[~stock_returns.index.duplicated(keep="last")]
    nifty_returns = nifty_returns[~nifty_returns.index.duplicated(keep="last")]

    combined = pd.concat([stock_returns, nifty_returns], axis=1, join="inner").dropna()
    if len(combined) < 10:
        return 1.0, 1.0
        
    cov_matrix = np.cov(combined.iloc[:, 0], combined.iloc[:, 1])
    variance_nifty = cov_matrix[1, 1]
    
    beta = cov_matrix[0, 1] / variance_nifty if variance_nifty > 0 else 1.0
    correlation = np.corrcoef(combined.iloc[:, 0], combined.iloc[:, 1])[0, 1]
    
    if np.isnan(beta):
        beta = 1.0
    if np.isnan(correlation):
        correlation = 1.0
        
    return round(float(beta), 2), round(float(correlation), 2)


def calculate_relative_strength(stock_df: pd.DataFrame, nifty_df: pd.DataFrame) -> Tuple[float, float, List[float]]:
    """
    Calculates Relative Strength ratio vs Nifty 50, Relative Strength Rating (0-100),
    and returns the historical RS Line series.
    """
    if stock_df.empty or nifty_df.empty:
        return 1.0, 50.0, []

    # Check if indexes are DatetimeIndexes (live trading datasets vs unit test RangeIndexes)
    is_datetime = isinstance(stock_df.index, pd.DatetimeIndex) and isinstance(nifty_df.index, pd.DatetimeIndex)
    
    if is_datetime:
        # Map daily benchmark dates to close prices
        nifty_daily = nifty_df["Close"].groupby(nifty_df.index.date).last()
        
        # Map stock timestamps to benchmark values on their respective dates
        aligned_nifty = stock_df.index.map(lambda dt: nifty_daily.get(dt.date()))
        aligned_nifty_series = pd.Series(aligned_nifty, index=stock_df.index).ffill().bfill()
        
        stock_close = stock_df["Close"][~stock_df.index.duplicated(keep="last")]
        aligned_nifty_series = aligned_nifty_series[~aligned_nifty_series.index.duplicated(keep="last")]

        combined = pd.DataFrame({
            "Stock": stock_close,
            "Nifty": aligned_nifty_series
        }).dropna()
    else:
        # Fallback to direct concat for non-datetime indexes (mock tests)
        s_close = stock_df["Close"][~stock_df.index.duplicated(keep="last")]
        n_close = nifty_df["Close"][~nifty_df.index.duplicated(keep="last")]
        combined = pd.concat([s_close, n_close], axis=1, join="inner").dropna()
        combined.columns = ["Stock", "Nifty"]
    
    rs_line = combined["Stock"] / combined["Nifty"]
    # Capture last 126 trading days (~6 months) of RS line values
    rs_line_list = [float(x) for x in rs_line.iloc[-126:].values]
    
    # Calculate RS Rating (0-100) based on RS line performance over last 126 days
    if len(rs_line) >= 126:
        prev_val = rs_line.iloc[-126]
        curr_val = rs_line.iloc[-1]
        rs_roc = (curr_val - prev_val) / prev_val
        # Center at 50, scale outpaces to a rating between 0 and 100
        rs_rating = min(max(50.0 + (rs_roc * 150.0), 0.0), 100.0)
    else:
        rs_rating = 50.0
        
    current_rs_vs_nifty = float(rs_line.iloc[-1])
    return round(current_rs_vs_nifty, 4), round(rs_rating, 2), rs_line_list


def analyze_sector_performance(
    sector_df: pd.DataFrame, 
    nifty_df: pd.DataFrame,
    sector_name: str, 
    sector_symbol: str
) -> Dict[str, Any]:
    """
    Computes sector trend, strength, momentum, and relative strength vs Nifty.
    """
    if sector_df.empty:
        return {
            "sector_name": sector_name,
            "sector_symbol": sector_symbol,
            "direction": "SIDEWAYS",
            "strength": 0.0,
            "relative_strength_vs_nifty": 1.0,
            "sector_momentum": 50.0
        }
        
    # Analyze sector trend over latest 6 months
    slice_df = sector_df.iloc[-126:]
    trend_analysis = analyze_horizon_trend(slice_df, "6M")
    
    # Relative strength of sector index vs Nifty
    sec_close = sector_df["Close"][~sector_df.index.duplicated(keep="last")]
    nifty_close = nifty_df["Close"][~nifty_df.index.duplicated(keep="last")]
    combined = pd.concat([sec_close, nifty_close], axis=1, join="inner").dropna()
    current_rs = float(combined.iloc[-1, 0] / combined.iloc[-1, 1]) if len(combined) > 0 else 1.0
    
    return {
        "sector_name": sector_name,
        "sector_symbol": sector_symbol,
        "direction": trend_analysis.direction,
        "strength": trend_analysis.strength,
        "relative_strength_vs_nifty": round(current_rs, 4),
        "sector_momentum": trend_analysis.momentum
    }
