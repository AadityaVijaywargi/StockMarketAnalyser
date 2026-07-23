import logging
from datetime import datetime
from typing import List, Dict, Any, Tuple
import numpy as np
import pandas as pd
from pydantic import BaseModel, Field
from config.settings import settings

logger = logging.getLogger("AIEquityResearchPlatform")

class SRZone(BaseModel):
    """
    Represents a Support or Resistance Zone.
    """
    upper_bound: float
    lower_bound: float
    strength: float = Field(..., ge=0.0, le=1.0)
    touches: int
    average_volume: float
    first_detection: str
    last_confirmation: str
    level_type: str = Field(..., description="support OR resistance")


def find_pivots(df: pd.DataFrame, window: int = 5) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    """
    Finds swing highs (pivot highs) and swing lows (pivot lows) in a DataFrame.
    A pivot high is a point greater than all highs in [i - window, i + window].
    """
    highs = df["High"].values
    lows = df["Low"].values
    dates = df.index.strftime("%Y-%m-%d").values
    volumes = df["Volume"].values
    
    pivot_highs = []
    pivot_lows = []
    
    n = len(df)
    for i in range(window, n - window):
        # Check high
        is_high = True
        curr_high = highs[i]
        for w in range(1, window + 1):
            if highs[i - w] >= curr_high or highs[i + w] > curr_high:
                is_high = False
                break
        if is_high:
            pivot_highs.append({
                "price": curr_high,
                "date": dates[i],
                "volume": float(volumes[i]),
                "index": i
            })
            
        # Check low
        is_low = True
        curr_low = lows[i]
        for w in range(1, window + 1):
            if lows[i - w] <= curr_low or lows[i + w] < curr_low:
                is_low = False
                break
        if is_low:
            pivot_lows.append({
                "price": curr_low,
                "date": dates[i],
                "volume": float(volumes[i]),
                "index": i
            })
            
    return pivot_highs, pivot_lows


def cluster_pivots(
    pivots: List[Dict[str, Any]], 
    current_price: float,
    bandwidth_pct: float = 0.015,
    level_type: str = "support"
) -> List[SRZone]:
    """
    Clusters price levels using a simple density-based agglomerative clustering.
    Two levels belong to the same cluster if they are within bandwidth_pct * center.
    """
    if not pivots:
        return []
        
    # Sort pivots by price
    sorted_pivots = sorted(pivots, key=lambda x: x["price"])
    
    clusters: List[List[Dict[str, Any]]] = []
    for p in sorted_pivots:
        if not clusters:
            clusters.append([p])
            continue
            
        # Compare with the average price of the last cluster
        last_cluster = clusters[-1]
        cluster_avg = np.mean([x["price"] for x in last_cluster])
        
        # If within bandwidth percentage, append to cluster
        if (p["price"] - cluster_avg) / cluster_avg <= bandwidth_pct:
            last_cluster.append(p)
        else:
            clusters.append([p])
            
    # Convert clusters to SRZone models
    zones = []
    max_touches = max([len(c) for c in clusters]) if clusters else 1
    
    for c in clusters:
        prices = [x["price"] for x in c]
        volumes = [x["volume"] for x in c]
        dates = sorted([x["date"] for x in c])
        
        touches = len(c)
        # Normalize strength between 0.1 and 1.0 based on touches
        strength = round(0.1 + 0.9 * (touches / max_touches), 2)
        
        # Sort out type based on current price relationship
        center = np.mean(prices)
        actual_type = "support" if current_price >= center else "resistance"
        
        # If type filter is specified and doesn't match, skip (or let it classify dynamically)
        if actual_type != level_type:
            continue
            
        zones.append(SRZone(
            upper_bound=float(np.max(prices)),
            lower_bound=float(np.min(prices)),
            strength=strength,
            touches=touches,
            average_volume=float(np.mean(volumes)),
            first_detection=dates[0],
            last_confirmation=dates[-1],
            level_type=actual_type
        ))
        
    # Sort zones by strength descending
    return sorted(zones, key=lambda x: x.strength, reverse=True)


def calculate_sr_zones(df: pd.DataFrame) -> Tuple[List[SRZone], List[SRZone]]:
    """
    Calculates support and resistance zones for a stock.
    Returns a tuple of (Support Zones, Resistance Zones).
    """
    if df.empty:
        return [], []
        
    current_price = float(df["Close"].iloc[-1])
    
    # Expose settings with default fallbacks
    pivot_window = settings.INDICATOR_PERIODS.get("pivot_window", 5)
    bandwidth_pct = settings.INDICATOR_PERIODS.get("sr_bandwidth_pct", 0.015)
    
    pivot_highs, pivot_lows = find_pivots(df, window=pivot_window)
    
    # Cluster pivot lows to find support zones
    support_zones = cluster_pivots(pivot_lows, current_price, bandwidth_pct, "support")
    # Cluster pivot highs to find resistance zones
    resistance_zones = cluster_pivots(pivot_highs, current_price, bandwidth_pct, "resistance")
    
    return support_zones, resistance_zones
