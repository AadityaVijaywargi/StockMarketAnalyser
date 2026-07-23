import pytest
import pandas as pd
import numpy as np
from unittest.mock import patch, MagicMock
from analysis.downloader import YahooDownloader

def test_clean_and_validate_logic():
    downloader = YahooDownloader()
    
    # Create raw mockup data with issues to clean
    dates = pd.date_range("2026-07-01", periods=5)
    df = pd.DataFrame({
        "Open": [100.0, 101.0, np.nan, 99.0, 102.0],  # NaN value
        "High": [95.0, 106.0, 103.0, 98.0, 105.0],    # High < Open in row 0
        "Low": [102.0, 97.0, 95.0, 96.0, 94.0],       # Low > Open in row 0
        "Close": [98.0, 102.0, 101.0, 97.0, 103.0],
        "Volume": [1000, -500, 1200, 1100, 1500]      # Negative volume in row 1
    }, index=dates)
    df.index.name = "Date"

    # Clean the dataframe
    cleaned = downloader._clean_and_validate(df, "TEST_TICKER")
    
    # 1. Verification: NaN filled
    assert not cleaned.isnull().values.any()
    
    # 2. Verification: Row 1 with negative volume should be filtered/dropped
    assert pd.Timestamp("2026-07-02") not in cleaned.index

    # 3. Verification: High must be adjusted to the max of Open/High/Low/Close
    # Row 0 (2026-07-01) had High=95, Open=100, Low=102, Close=98. Max is 102.
    assert cleaned.loc[pd.Timestamp("2026-07-01"), "High"] == 102.0

    # 4. Verification: Low must be adjusted to the min of Open/High/Low/Close
    assert cleaned.loc[pd.Timestamp("2026-07-01"), "Low"] == 98.0


@patch('yfinance.download')
def test_download_ticker_data_success(mock_yf_download):
    downloader = YahooDownloader()
    
    # Create simple valid mock dataframe returned by yfinance
    dates = pd.date_range("2026-07-01", periods=3)
    mock_df = pd.DataFrame({
        "Open": [100.0, 101.0, 102.0],
        "High": [105.0, 106.0, 107.0],
        "Low": [95.0, 96.0, 97.0],
        "Close": [100.0, 102.0, 105.0],
        "Adj Close": [100.0, 102.0, 105.0],
        "Volume": [1000, 1200, 1500]
    }, index=dates)
    mock_df.index.name = "Date"
    
    mock_yf_download.return_value = mock_df
    
    df = downloader.download_ticker_data("RELIANCE.NS", years=2)
    
    assert mock_yf_download.called
    assert len(df) == 3
    assert "Adj Close" in df.columns
