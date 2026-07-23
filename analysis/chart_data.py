import logging
import numpy as np
import pandas as pd
from typing import List, Dict, Any
from analysis.models.chart import ChartDataModel
from analysis.support_resistance import SRZone
from analysis.models.patterns import PatternDetection

logger = logging.getLogger("AIEquityResearchPlatform")

def clean_float_list(series: Any) -> List[float]:
    """Converts a pandas Series or numpy array containing NaNs or infs to clean float list."""
    if isinstance(series, pd.Series):
        arr = series.values
    else:
        arr = np.asarray(series)
    # Replace NaN with None for JSON compatibility
    return [float(x) if (np.notnull(x) and not np.isnan(x) and not np.isinf(x)) else None for x in arr]


def build_chart_data(
    df: pd.DataFrame, 
    support_zones: List[SRZone], 
    resistance_zones: List[SRZone], 
    patterns: List[PatternDetection]
) -> ChartDataModel:
    """
    Constructs a JSON-serializable visual payload of stock prices, technical indicators,
    support/resistance overlays, and pattern coordinates.
    """
    logger.info("Constructing client visualization payload...")
    
    # 1. Base price series
    dates = df.index.strftime("%Y-%m-%d").tolist()
    opens = [float(x) if (pd.notnull(x) and not np.isnan(x)) else 0.0 for x in df["Open"].values]
    highs = [float(x) if (pd.notnull(x) and not np.isnan(x)) else 0.0 for x in df["High"].values]
    lows = [float(x) if (pd.notnull(x) and not np.isnan(x)) else 0.0 for x in df["Low"].values]
    closes = [float(x) if (pd.notnull(x) and not np.isnan(x)) else 0.0 for x in df["Close"].values]
    volumes = [int(x) if (pd.notnull(x) and not np.isnan(x) and not np.isinf(x)) else 0 for x in df["Volume"].values]
    
    # 2. Extract Moving Averages
    moving_averages = {}
    ma_cols = [col for col in df.columns if col.startswith("SMA_") or col.startswith("EMA_")]
    for col in ma_cols:
        moving_averages[col] = [
            float(x) if (pd.notnull(x) and not np.isnan(x)) else 0.0 
            for x in df[col].values
        ]
        
    # 3. Support/Resistance lines (using midpoints of strong zones)
    support_lines = [round((z.upper_bound + z.lower_bound) / 2.0, 2) for z in support_zones[:3]]
    resistance_lines = [round((z.upper_bound + z.lower_bound) / 2.0, 2) for z in resistance_zones[:3]]
    
    # 4. Pattern overlays
    # Annotates coordinate markers for shape drawing in charts
    patterns_coordinates = []
    for p in patterns:
        patterns_coordinates.append({
            "pattern_name": p.pattern_name,
            "start_date": p.start_date,
            "end_date": p.end_date,
            "direction": p.pattern_direction,
            "status": p.pattern_status,
            "key_levels": p.key_price_levels,
            "label": f"{p.pattern_name} ({p.pattern_status})"
        })
        
    return ChartDataModel(
        dates=dates,
        open=opens,
        high=highs,
        low=lows,
        close=closes,
        volume=volumes,
        moving_averages=moving_averages,
        support_lines=support_lines,
        resistance_lines=resistance_lines,
        patterns_coordinates=patterns_coordinates
    )
