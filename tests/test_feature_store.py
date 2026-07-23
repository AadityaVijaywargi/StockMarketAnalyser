import os
import shutil
import pytest
import pandas as pd
from datetime import datetime
from analysis.feature_store import FeatureStore

@pytest.fixture
def temp_features_dir():
    """Fixture to create and clean up temporary features directory."""
    test_dir = "storage/test_features"
    os.makedirs(test_dir, exist_ok=True)
    yield test_dir
    if os.path.exists(test_dir):
        shutil.rmtree(test_dir)


def test_feature_store_save_load_metadata(temp_features_dir):
    """Verify FeatureStore can save DataFrame with schema metadata and load it back."""
    fs = FeatureStore(features_dir=temp_features_dir)
    ticker = "RELIANCE_TEST"
    
    # Create sample DataFrame
    dates = pd.date_range(start="2026-07-01", periods=5)
    df = pd.DataFrame({
        "Open": [100.0, 101.0, 102.0, 103.0, 104.0],
        "Close": [101.0, 102.0, 103.0, 104.0, 105.0]
    }, index=dates)
    df.index.name = "Date"

    custom_metadata = {
        "author": "Antigravity",
        "parameters": {"ma_fast": 9, "ma_slow": 21},
        "is_active": True
    }
    
    # Save features
    fs.save_features(ticker, df, custom_metadata)
    
    # Verify file exists
    assert os.path.exists(fs.get_feature_path(ticker))
    
    # Load features
    loaded_df = fs.load_features(ticker)
    assert loaded_df is not None
    assert len(loaded_df) == 5
    assert list(loaded_df.columns) == ["Open", "Close"]
    
    # Load metadata
    loaded_meta = fs.load_metadata(ticker)
    assert loaded_meta["author"] == "Antigravity"
    assert loaded_meta["is_active"] == True
    # Pydantic/json serialization converts dicts to json or preserves them
    assert loaded_meta["parameters"]["ma_fast"] == 9


def test_feature_store_incremental_enrichment(temp_features_dir):
    """Verify enrich_features adds new columns incrementally and registers metadata."""
    fs = FeatureStore(features_dir=temp_features_dir)
    ticker = "INFY_TEST"
    
    # Step 1: Initialize features with raw OHLC
    dates = pd.date_range(start="2026-07-01", periods=3)
    df_raw = pd.DataFrame({
        "Open": [100.0, 101.0, 102.0],
        "Close": [102.0, 100.0, 103.0]
    }, index=dates)
    df_raw.index.name = "Date"
    
    df_enriched1 = fs.enrich_features(ticker, df_raw, stage_name="raw_ohlc")
    assert "Open" in df_enriched1.columns
    assert "Close" in df_enriched1.columns
    
    # Step 2: Add technical indicators (SMA)
    df_indicators = pd.DataFrame({
        "SMA_10": [100.5, 101.0, 101.5]
    }, index=dates)
    df_indicators.index.name = "Date"
    
    df_enriched2 = fs.enrich_features(ticker, df_indicators, stage_name="indicators")
    assert "Open" in df_enriched2.columns
    assert "SMA_10" in df_enriched2.columns
    assert len(df_enriched2.columns) == 3
    
    # Verify metadata shows both stages
    metadata = fs.load_metadata(ticker)
    assert "stage_raw_ohlc" in metadata
    assert "stage_indicators" in metadata
    assert metadata["stage_indicators"]["columns"] == ["SMA_10"]
