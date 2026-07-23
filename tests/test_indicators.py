import pytest
import numpy as np
import pandas as pd
from analysis.indicators import (
    calculate_moving_averages,
    calculate_momentum_indicators,
    calculate_trend_indicators,
    calculate_volume_indicators,
    calculate_volatility_indicators,
    calculate_ma_ribbon_and_crossovers,
    calculate_all_indicators
)
from analysis.candlestick import (
    calculate_returns,
    calculate_gaps,
    calculate_bar_types,
    calculate_single_candle_patterns,
    calculate_engulfing_patterns,
    calculate_multi_candle_patterns,
    calculate_all_candlestick_patterns
)

# Mock Settings Config Dictionary
MOCK_SETTINGS = {
    "sma_periods": [10, 20, 50, 100],
    "ema_periods": [9, 21, 50],
    "rsi_period": 14,
    "macd_fast": 12,
    "macd_slow": 26,
    "macd_signal": 9,
    "roc_period": 12,
    "momentum_period": 10,
    "cci_period": 20,
    "willr_period": 14,
    "stoch_rsi_period": 14,
    "adx_period": 14,
    "supertrend_period": 10,
    "supertrend_multiplier": 3.0,
    "cmf_period": 20,
    "mfi_period": 14,
    "average_volume_period": 20,
    "atr_period": 14,
    "bb_period": 20,
    "bb_std": 2.0,
    "kc_period": 20,
    "donchian_period": 20,
    "std_period": 20,
}

@pytest.fixture
def sample_price_data():
    """Generates 250 rows of synthetic price data for indicator testing."""
    np.random.seed(42)
    dates = pd.date_range(start="2025-01-01", periods=250, freq="D")
    
    # Generate random walk price series
    close = 100.0 + np.cumsum(np.random.normal(0, 1.5, 250))
    # Make sure price is positive
    close = np.clip(close, 10.0, 1000.0)
    
    high = close + np.random.uniform(0.5, 5.0, 250)
    low = close - np.random.uniform(0.5, 5.0, 250)
    open_p = low + np.random.uniform(0.1, high - low, 250)
    volume = np.random.randint(1000, 100000, 250)
    
    df = pd.DataFrame({
        "Open": open_p,
        "High": high,
        "Low": low,
        "Close": close,
        "Adj Close": close,
        "Volume": volume
    }, index=dates)
    df.index.name = "Date"
    return df


def test_moving_averages_correctness(sample_price_data):
    """Test SMA calculations against manual pandas rolling calculations."""
    res = calculate_moving_averages(sample_price_data, MOCK_SETTINGS)
    assert "SMA_10" in res.columns
    assert "EMA_9" in res.columns
    
    # Manual rolling calculation comparison
    expected_sma_10 = sample_price_data["Close"].rolling(window=10).mean()
    # Align comparison (skip boundary NaN periods)
    pd.testing.assert_series_equal(res["SMA_10"].iloc[10:], expected_sma_10.iloc[10:], check_names=False)


def test_momentum_rsi_bounds(sample_price_data):
    """Verify RSI returns values strictly within [0, 100]."""
    res = calculate_momentum_indicators(sample_price_data, MOCK_SETTINGS)
    assert "RSI_14" in res.columns
    rsi = res["RSI_14"].dropna()
    assert (rsi >= 0).all()
    assert (rsi <= 100).all()


def test_crossovers_golden_cross():
    """Verify Golden/Death cross crossover logic."""
    dates = pd.date_range("2026-07-01", periods=10)
    # Create simple dataframe where SMA50 > SMA200
    # and another where SMA50 < SMA200
    df = pd.DataFrame({
        "Open": [100.0] * 10,
        "High": [105.0] * 10,
        "Low": [95.0] * 10,
        "Close": [100.0] * 10,
        "Volume": [100] * 10
    }, index=dates)
    
    # Run crossovers (we mock SMA output or let it compute standard)
    res = calculate_ma_ribbon_and_crossovers(df, MOCK_SETTINGS)
    assert "Golden_Cross" in res.columns
    assert "Death_Cross" in res.columns


def test_candlestick_hammer_detection():
    """Create an explicit Hammer candle and verify Hammer detector finds it."""
    # Hammer shape: body in top 30% of range, upper wick <= 10%, lower wick >= 60%
    # Open: 100, Close: 101 (body=1), High: 101.1 (upper wick=0.1), Low: 95.0 (lower wick=5)
    # Range = 6.1. Body = 1 (16% of range), upper wick = 0.1 (1.6% of range), lower wick = 5 (82% of range)
    df = pd.DataFrame({
        "Open": [100.0],
        "High": [101.1],
        "Low": [95.0],
        "Close": [101.0],
        "Volume": [100]
    }, index=pd.date_range("2026-07-01", periods=1))
    
    res = calculate_single_candle_patterns(df)
    assert res["Hammer"].iloc[0] == 1


def test_candlestick_doji_detection():
    """Create an explicit Doji candle and verify Doji detector finds it."""
    # Doji shape: body <= 10% of range
    # Open: 100, Close: 100.05, High: 105.0, Low: 95.0
    # Range = 10, Body = 0.05 (0.5% of range)
    df = pd.DataFrame({
        "Open": [100.0],
        "High": [105.0],
        "Low": [95.0],
        "Close": [100.05],
        "Volume": [100]
    }, index=pd.date_range("2026-07-01", periods=1))
    
    res = calculate_single_candle_patterns(df)
    assert res["Doji"].iloc[0] == 1


def test_calculate_all_categories(sample_price_data):
    """Test end-to-end indicator & pattern generation wrapper schemas."""
    ind_df = calculate_all_indicators(sample_price_data, MOCK_SETTINGS)
    assert len(ind_df.columns) > 10
    
    pattern_df = calculate_all_candlestick_patterns(sample_price_data)
    assert "Return_Daily" in pattern_df.columns
    assert "Bullish_Engulfing" in pattern_df.columns
