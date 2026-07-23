import pytest
import numpy as np
import pandas as pd
from analysis.support_resistance import calculate_sr_zones, find_pivots
from analysis.patterns import (
    detect_trend_structure,
    detect_double_top_bottom,
    detect_head_shoulders,
    detect_triangles_and_rectangles,
    detect_cup_and_handle,
    detect_breakouts,
    detect_all_patterns
)
from analysis.trend import run_trend_engine
from analysis.chart_data import build_chart_data

def get_base_flat_df(length: int = 60, price: float = 100.0) -> pd.DataFrame:
    """Helper to generate flat base price DataFrame."""
    dates = pd.date_range("2026-07-01", periods=length)
    df = pd.DataFrame({
        "Open": [price] * length,
        "High": [price + 1.0] * length,
        "Low": [price - 1.0] * length,
        "Close": [price] * length,
        "Volume": [1000] * length
    }, index=dates)
    df.index.name = "Date"
    return df


def test_support_resistance_zones():
    """Verify pivots find peaks and valleys, and cluster them into zones."""
    df = get_base_flat_df(length=60, price=100.0)
    
    # Introduce explicit swing highs (pivot highs) at day 15 and day 35
    df.loc[df.index[15], "High"] = 120.0
    df.loc[df.index[15], "Close"] = 118.0
    
    df.loc[df.index[35], "High"] = 121.0
    df.loc[df.index[35], "Close"] = 119.0
    
    # Introduce swing lows (pivot lows) at day 25 and day 45
    df.loc[df.index[25], "Low"] = 80.0
    df.loc[df.index[25], "Close"] = 82.0
    
    df.loc[df.index[45], "Low"] = 81.0
    df.loc[df.index[45], "Close"] = 83.0
    
    # Run pivots
    highs, lows = find_pivots(df, window=5)
    assert len(highs) >= 2
    assert len(lows) >= 2
    
    # Run clustering
    support, resistance = calculate_sr_zones(df)
    assert len(support) > 0
    assert len(resistance) > 0
    
    # Check boundaries of resistance zone (should be around 120)
    assert resistance[0].lower_bound <= 121.0
    assert resistance[0].upper_bound >= 120.0
    
    # Check support zone boundaries (should be around 80)
    assert support[0].lower_bound <= 81.0
    assert support[0].upper_bound >= 80.0


def test_double_top_detection():
    """Verify Double Top detection when price breaks below neckline valley."""
    df = get_base_flat_df(length=60, price=100.0)
    
    # Construct Double Top shape:
    # Day 15: First Peak (High=120)
    df.loc[df.index[15], "High"] = 120.0
    df.loc[df.index[15], "Close"] = 119.0
    # Day 25: Intervening Valley (Low=95)
    df.loc[df.index[25], "Low"] = 95.0
    df.loc[df.index[25], "Close"] = 96.0
    # Day 35: Second Peak (High=120.5)
    df.loc[df.index[35], "High"] = 120.5
    df.loc[df.index[35], "Close"] = 119.0
    
    # Day 50: Price drops below valley neckline (Close=90)
    df.loc[df.index[50:], "Close"] = 90.0
    
    highs, lows = find_pivots(df, window=4)
    patterns = detect_double_top_bottom(df, highs, lows)
    
    double_tops = [p for p in patterns if p.pattern_name == "Double Top"]
    assert len(double_tops) == 1
    assert double_tops[0].pattern_status == "Confirmed"
    assert double_tops[0].pattern_direction == "BEARISH"


def test_head_and_shoulders_detection():
    """Verify Head and Shoulders detection with distinct Left/Head/Right peaks."""
    df = get_base_flat_df(length=80, price=100.0)
    
    # Left Shoulder: Day 15 (High=110)
    df.loc[df.index[15], "High"] = 110.0
    df.loc[df.index[15], "Close"] = 109.0
    # Valley 1: Day 25 (Low=95)
    df.loc[df.index[25], "Low"] = 95.0
    df.loc[df.index[25], "Close"] = 96.0
    # Head: Day 35 (High=120)
    df.loc[df.index[35], "High"] = 120.0
    df.loc[df.index[35], "Close"] = 119.0
    # Valley 2: Day 45 (Low=96)
    df.loc[df.index[45], "Low"] = 96.0
    df.loc[df.index[45], "Close"] = 97.0
    # Right Shoulder: Day 55 (High=111)
    df.loc[df.index[55], "High"] = 111.0
    df.loc[df.index[55], "Close"] = 110.0
    
    # Day 70: Break neckline
    df.loc[df.index[70:], "Close"] = 90.0
    
    highs, lows = find_pivots(df, window=4)
    patterns = detect_head_shoulders(df, highs, lows)
    
    hns = [p for p in patterns if p.pattern_name == "Head and Shoulders"]
    assert len(hns) == 1
    assert hns[0].pattern_status == "Confirmed"


def test_trend_engine_horizons():
    """Verify trend engine outputs correct horizons and structures."""
    df = get_base_flat_df(length=150, price=100.0)
    
    # Introduce clear bullish trend (Close goes from 100 to 150)
    prices = np.linspace(100.0, 150.0, 150)
    df["Close"] = prices
    df["High"] = prices + 0.5
    df["Low"] = prices - 0.5
    
    # Add dummy indicators so it doesn't fail RSI lookup
    df["RSI_14"] = [55.0] * 150
    
    trend_report = run_trend_engine(df)
    assert "1M" in trend_report
    assert "3M" in trend_report
    assert "6M" in trend_report
    
    # Under a linear rise, trend should be BULLISH
    assert trend_report["1M"].direction == "BULLISH"
    assert trend_report["1M"].strength > 80.0


def test_chart_data_builder():
    """Verify that build_chart_data serializes inputs properly."""
    df = get_base_flat_df(length=30, price=100.0)
    df["SMA_10"] = df["Close"].rolling(10).mean()
    
    support_zones, resistance_zones = calculate_sr_zones(df)
    patterns = detect_all_patterns(df)
    
    chart_payload = build_chart_data(df, support_zones, resistance_zones, patterns)
    
    assert len(chart_payload.dates) == 30
    assert "SMA_10" in chart_payload.moving_averages
    # Verify moving average has no NaNs (replaced with 0.0)
    assert not any(np.isnan(x) for x in chart_payload.moving_averages["SMA_10"])
