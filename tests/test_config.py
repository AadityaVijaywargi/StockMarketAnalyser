import os
from config.settings import settings
from config.constants import SUPPORTED_TIMEFRAMES, SECTOR_MAP
from config.weights import DEFAULT_SCORE_WEIGHTS

def test_settings_load():
    """Verify that settings are loaded with correct defaults."""
    assert settings.ENV in ["development", "production", "test"]
    assert settings.DEFAULT_YEARS_DATA >= 2
    assert settings.PRIMARY_WINDOW_MONTHS == 6
    assert settings.BUY_THRESHOLD == 70.0
    assert settings.WATCH_THRESHOLD == 50.0
    
def test_directory_creation():
    """Verify settings.create_directories() creates folders."""
    settings.create_directories()
    assert os.path.exists(settings.STORAGE_BASE)
    assert os.path.exists(settings.CACHE_DIR)
    assert os.path.exists(settings.FEATURES_DIR)
    assert os.path.exists(settings.REPORTS_DIR)

def test_constants():
    """Verify base constants exist."""
    assert len(SUPPORTED_TIMEFRAMES) == 5
    assert "RELIANCE.NS" in SECTOR_MAP
    assert "TCS.NS" in SECTOR_MAP

def test_weights_sum():
    """Verify default weights sum to approximately 1.0."""
    total_weight = sum(DEFAULT_SCORE_WEIGHTS.values())
    assert abs(total_weight - 1.0) < 1e-5
