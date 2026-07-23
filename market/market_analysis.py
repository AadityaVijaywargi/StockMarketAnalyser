import logging
import pandas as pd
from typing import Dict, Any
from analysis.trend import analyze_horizon_trend
from config.constants import DEFAULT_BENCHMARK_INDEX, BANK_NIFTY_INDEX

logger = logging.getLogger("AIEquityResearchPlatform")

def analyze_index_trend(index_df: pd.DataFrame, symbol: str) -> Dict[str, Any]:
    """
    Analyzes the index (Nifty or Bank Nifty) and returns trend direction, strength, and momentum.
    """
    if index_df.empty:
        return {
            "symbol": symbol,
            "direction": "SIDEWAYS",
            "strength": 0.0,
            "momentum": 50.0
        }
        
    # Analyze the index over a 6-month window (126 trading days)
    slice_df = index_df.iloc[-126:]
    analysis = analyze_horizon_trend(slice_df, "6M")
    
    return {
        "symbol": symbol,
        "direction": analysis.direction,
        "strength": analysis.strength,
        "momentum": analysis.momentum
    }
