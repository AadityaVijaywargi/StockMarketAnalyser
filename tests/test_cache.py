import os
import shutil
import pytest
import pandas as pd
from datetime import datetime, date
from unittest.mock import patch, MagicMock
from analysis.cache import FileCacheManager

@pytest.fixture
def temp_cache_dir():
    """Create a temporary directory for cache testing."""
    test_dir = "storage/test_cache"
    os.makedirs(test_dir, exist_ok=True)
    yield test_dir
    if os.path.exists(test_dir):
        shutil.rmtree(test_dir)


def test_cache_set_and_get(temp_cache_dir):
    """Test saving to cache and loading from cache."""
    cache = FileCacheManager(cache_dir=temp_cache_dir)
    ticker = "TEST_STOCK"
    
    # Create sample DataFrame
    dates = pd.date_range(start="2026-07-10", end="2026-07-15", freq="D")
    df = pd.DataFrame({
        "Open": [100.0] * len(dates),
        "High": [105.0] * len(dates),
        "Low": [98.0] * len(dates),
        "Close": [102.0] * len(dates),
        "Adj Close": [102.0] * len(dates),
        "Volume": [1000] * len(dates),
    }, index=dates)
    df.index.name = "Date"

    # Set cache
    assert cache.set(ticker, df) is True
    
    # Verify file exists
    cache_file = cache.get_cache_path(ticker)
    assert os.path.exists(cache_file)
    
    # Get cache and verify contents
    # For test simplicity, we mock is_cache_valid to return True
    with patch.object(cache, 'is_cache_valid', return_value=True):
        cached_df = cache.get(ticker)
        assert cached_df is not None
        assert len(cached_df) == len(df)
        assert list(cached_df.columns) == ["Open", "High", "Low", "Close", "Adj Close", "Volume"]


@patch('analysis.cache.datetime')
def test_cache_validity_rules(mock_datetime, temp_cache_dir):
    """Test weekend/weekday and market hours cache validation rules."""
    cache = FileCacheManager(cache_dir=temp_cache_dir)
    ticker = "TEST_VALIDITY"
    
    # Setup mock date/times
    # 2026-07-22 is Wednesday
    tz = cache.timezone
    
    # Save a file with last date 2026-07-21
    dates = pd.date_range(start="2026-07-10", end="2026-07-21")
    df = pd.DataFrame({
        "Open": [100.0] * len(dates),
        "High": [105.0] * len(dates),
        "Low": [98.0] * len(dates),
        "Close": [102.0] * len(dates),
        "Adj Close": [102.0] * len(dates),
        "Volume": [1000] * len(dates),
    }, index=dates)
    df.index.name = "Date"
    cache.set(ticker, df)

    # Scenario A: Today is Wednesday 2026-07-22, 10:00 AM IST (before market close)
    # Cache has 2026-07-21 (yesterday). This is VALID.
    mock_now = datetime(2026, 7, 22, 10, 0, 0, tzinfo=tz)
    mock_datetime.now.return_value = mock_now
    mock_datetime.strptime.side_effect = datetime.strptime
    assert cache.is_cache_valid(ticker) is True

    # Scenario B: Today is Wednesday 2026-07-22, 4:00 PM IST (after market close)
    # Cache has 2026-07-21 (yesterday). Cutoff has passed, we need today's data. This is INVALID.
    mock_now = datetime(2026, 7, 22, 16, 0, 0, tzinfo=tz)
    mock_datetime.now.return_value = mock_now
    assert cache.is_cache_valid(ticker) is False

    # Scenario C: Today is Saturday 2026-07-25.
    # Cache has 2026-07-21. Last Friday was 2026-07-24. Cache is missing Friday. This is INVALID.
    mock_now = datetime(2026, 7, 25, 12, 0, 0, tzinfo=tz)
    mock_datetime.now.return_value = mock_now
    assert cache.is_cache_valid(ticker) is False


def test_in_memory_live_cache():
    """Test InMemoryLiveCache functionality: quote caching, analysis caching, and timeframe-aware invalidation."""
    from analysis.cache import InMemoryLiveCache
    import pytz
    from datetime import datetime as test_datetime
    
    live_cache = InMemoryLiveCache()
    ticker = "RELIANCE.NS"
    
    # 1. Test live quote cache
    quote = {
        "ticker": ticker,
        "price": 2450.0,
        "change": 12.0,
        "change_pct": 0.5,
        "high": 2460.0,
        "low": 2430.0,
        "volume": 120000,
        "last_updated": "2026-07-23T13:10:00+05:30",
        "is_market_open": True
    }
    
    live_cache.set_quote(ticker, quote)
    cached_quote = live_cache.get_quote(ticker)
    assert cached_quote is not None
    assert cached_quote["price"] == 2450.0
    
    # 2. Test analysis cache write & read
    report = {
        "ticker": ticker,
        "scores": {"overall_score": 75.0, "confidence": 85.0, "recommendation": "BUY"},
        "chart_data": {"close": [2430.0, 2440.0, 2450.0], "high": [2440.0, 2450.0, 2460.0], "low": [2420.0, 2435.0, 2440.0], "volume": [100, 110, 120]},
        "metadata": {}
    }
    
    tz = pytz.timezone("Asia/Kolkata")
    last_idx_time = test_datetime(2026, 7, 23, 13, 10, 0, tzinfo=tz)
    
    # Store with interval "5m"
    live_cache.set_analysis(ticker, "5m", last_idx_time, report)
    
    # Check retrieval when market is open and no new candle has completed
    with patch('analysis.cache.datetime') as mock_dt:
        mock_now = test_datetime(2026, 7, 23, 13, 13, 0, tzinfo=tz)
        mock_dt.now.return_value = mock_now
        
        cached_analysis = live_cache.get_analysis(ticker, "5m")
        assert cached_analysis is not None
        assert cached_analysis["scores"]["overall_score"] == 75.0

    # Check invalidation when a new candle completes
    with patch('analysis.cache.datetime') as mock_dt:
        mock_now = test_datetime(2026, 7, 23, 13, 16, 0, tzinfo=tz)
        mock_dt.now.return_value = mock_now
        
        cached_analysis = live_cache.get_analysis(ticker, "5m")
        assert cached_analysis is None

