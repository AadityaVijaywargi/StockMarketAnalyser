import logging
import numpy as np
import pandas as pd
from typing import Dict, Any
from config.settings import settings

logger = logging.getLogger("AIEquityResearchPlatform")

def analyze_vix(vix_df: pd.DataFrame) -> Dict[str, Any]:
    """
    Analyzes India VIX levels and determines the current volatility regime.
    Regimes: Low, Normal, Elevated, Extreme.
    """
    if vix_df.empty:
        # Fallback if no VIX data
        return {
            "vix_value": 15.0,
            "percentile": 50.0,
            "regime": "Normal"
        }

    current_vix = float(vix_df["Close"].iloc[-1])
    
    # Calculate historical percentile over the last 250 trading days
    vix_series = vix_df["Close"].iloc[-250:].values
    percentile = float(np.sum(vix_series <= current_vix) / len(vix_series) * 100.0)
    
    # Regimes thresholds loaded from settings (Safe fallbacks)
    vix_low = settings.INDICATOR_PERIODS.get("vix_low_threshold", 13.0)
    vix_elevated = settings.INDICATOR_PERIODS.get("vix_elevated_threshold", 18.0)
    vix_extreme = settings.INDICATOR_PERIODS.get("vix_extreme_threshold", 25.0)

    if current_vix < vix_low:
        regime = "Low"
    elif current_vix < vix_elevated:
        regime = "Normal"
    elif current_vix < vix_extreme:
        regime = "Elevated"
    else:
        regime = "Extreme"
        
    logger.info(f"India VIX: {current_vix:.2f} (Percentile: {percentile:.1f}%, Regime: {regime})")
    
    return {
        "vix_value": round(current_vix, 2),
        "percentile": round(percentile, 2),
        "regime": regime
    }
