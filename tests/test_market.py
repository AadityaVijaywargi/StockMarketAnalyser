import os
import shutil
import pytest
import pandas as pd
from unittest.mock import patch, MagicMock
from market.market_downloader import MarketDownloader

@pytest.fixture
def temp_market_dir():
    """Create a temporary directory for market index cache testing."""
    test_dir = "storage/test_market"
    os.makedirs(test_dir, exist_ok=True)
    yield test_dir
    if os.path.exists(test_dir):
        shutil.rmtree(test_dir)


@patch('market.market_downloader.YahooDownloader')
def test_market_downloader_caching(mock_downloader_cls, temp_market_dir):
    """Verify that MarketDownloader caches downloads and serves cache hits."""
    # Setup mock YahooDownloader
    mock_downloader = MagicMock()
    mock_downloader_cls.return_value = mock_downloader
    
    dates = pd.date_range("2026-07-01", periods=2)
    mock_df = pd.DataFrame({
        "Open": [100.0, 101.0],
        "High": [102.0, 103.0],
        "Low": [98.0, 99.0],
        "Close": [101.0, 102.0],
        "Adj Close": [101.0, 102.0],
        "Volume": [100, 200]
    }, index=dates)
    mock_df.index.name = "Date"
    mock_downloader.download_index_data.return_value = mock_df

    # Mock settings directories
    with patch('market.market_downloader.settings') as mock_settings:
        mock_settings.MARKET_DIR = temp_market_dir
        mock_settings.DEFAULT_YEARS_DATA = 5
        mock_settings.MARKET_TIMEZONE = "Asia/Kolkata"
        
        md = MarketDownloader()
        
        # 1. First call: Cache miss -> Download
        df1 = md.get_index_data("^NSEI")
        assert len(df1) == 2
        assert mock_downloader.download_index_data.call_count == 1
        
        # Verify file is stored in custom market cache folder
        cache_file = md.cache.get_cache_path("^NSEI")
        assert os.path.exists(cache_file)

        # 2. Second call: Cache hit -> No download
        mock_downloader.download_index_data.reset_mock()
        
        # Mock is_cache_valid to return True
        with patch.object(md.cache, 'is_cache_valid', return_value=True):
            df2 = md.get_index_data("^NSEI")
            assert len(df2) == 2
            assert mock_downloader.download_index_data.call_count == 0
