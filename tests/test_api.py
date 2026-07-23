import pytest
import pandas as pd
from fastapi.testclient import TestClient
from api.api import create_app
from api.deps import get_downloader, get_cache, get_market_downloader
from analysis.downloader import YahooDownloader
from analysis.cache import FileCacheManager
from market.market_downloader import MarketDownloader

app = create_app()
client = TestClient(app)


class MockYahooDownloader(YahooDownloader):
    def download_ticker_data(self, ticker: str, years: int = None, interval: str = "1d", period: str = None) -> pd.DataFrame:
        if ticker.startswith("INVALID"):
            raise ValueError(f"Symbol {ticker} not found")
        dates = pd.date_range("2026-01-01", periods=300)
        df = pd.DataFrame({
            "Open": [100.0] * 300,
            "High": [101.0] * 300,
            "Low": [99.0] * 300,
            "Close": [100.0] * 300,
            "Volume": [1000] * 300
        }, index=dates)
        df.index.name = "Date"
        return df


class MockFileCacheManager(FileCacheManager):
    def __init__(self):
        self._store = {}
    def get(self, ticker: str, interval: str = "1d") -> pd.DataFrame:
        return self._store.get((ticker, interval))
    def set(self, ticker: str, df: pd.DataFrame, interval: str = "1d") -> None:
        self._store[(ticker, interval)] = df
        return True


class MockMarketDownloader(MarketDownloader):
    def get_index_data(self, symbol: str) -> pd.DataFrame:
        dates = pd.date_range("2026-01-01", periods=300)
        price = 24000.0 if "NIFTY" in symbol else (15.0 if "VIX" in symbol else 1000.0)
        df = pd.DataFrame({
            "Open": [price] * 300,
            "High": [price + 10] * 300,
            "Low": [price - 10] * 300,
            "Close": [price] * 300,
            "Volume": [5000] * 300
        }, index=dates)
        df.index.name = "Date"
        return df


# Apply dependency overrides for offline-isolated testing
@pytest.fixture(autouse=True)
def setup_api_overrides():
    app.dependency_overrides[get_downloader] = lambda: MockYahooDownloader()
    app.dependency_overrides[get_cache] = lambda: MockFileCacheManager()
    app.dependency_overrides[get_market_downloader] = lambda: MockMarketDownloader()
    yield
    app.dependency_overrides.clear()


def test_root_endpoint():
    """Verify service registrations are returned."""
    response = client.get("/")
    assert response.status_code == 200
    json = response.json()
    assert json["service"] == "AI Equity Research Platform"
    assert json["status"] == "running"


def test_health_endpoint():
    """Verify health endpoints check connectivity and file structures."""
    response = client.get("/health")
    assert response.status_code == 200
    json = response.json()
    assert "status" in json
    assert "python_version" in json
    assert "data_provider" in json


def test_analyze_ticker_success():
    """Verify single ticker returns full quantitative reports."""
    # Test valid ticker RELIANCE
    response = client.get("/analyze/RELIANCE")
    assert response.status_code == 200
    json = response.json()
    assert json["ticker"] == "RELIANCE.NS"
    assert "scores" in json
    assert "risk_profile" in json
    assert "chart_data" in json
    assert "patterns" in json
    assert "support_zones" in json
    assert "resistance_zones" in json


def test_analyze_ticker_with_debug():
    """Verify debug mode appends pipeline timing metadata."""
    response = client.get("/analyze/TCS.NS?debug=true")
    assert response.status_code == 200
    json = response.json()
    assert "metadata" in json
    assert "timings" in json["metadata"]
    assert "total_pipeline_time_ms" in json["metadata"]["timings"]


def test_analyze_ticker_invalid_format():
    """Verify invalid format symbols return 400 Bad Request."""
    response = client.get("/analyze/INV@LID")
    assert response.status_code == 400
    assert "Invalid ticker symbol format" in response.json()["detail"]


def test_analyze_ticker_not_found():
    """Verify missing/invalid stock names return 404 Not Found."""
    response = client.get("/analyze/INVALID_TICKER")
    assert response.status_code == 404
    assert "not found" in response.json()["detail"].lower()


def test_analyze_batch_tickers():
    """Verify batch POST endpoint processes lists of stocks and de-duplicates them."""
    response = client.post("/analyze", json=["RELIANCE.NS", "TCS", "RELIANCE"])
    assert response.status_code == 200
    json = response.json()
    # De-duplicated size should be 2: RELIANCE.NS and TCS.NS
    assert len(json) == 2
    assert json[0]["ticker"] == "RELIANCE.NS"
    assert json[1]["ticker"] == "TCS.NS"


def test_analyze_batch_too_large():
    """Verify batch sizes exceeding limit return 400 Bad Request."""
    tickers = ["RELIANCE", "TCS", "INFY", "WIPRO", "HDFCBANK", "SBIN"]
    response = client.post("/analyze", json=tickers)
    assert response.status_code == 400
    assert "Maximum batch size exceeded" in response.json()["detail"]


def test_get_live_quote_endpoint():
    """Verify that the lightweight live quote endpoint returns a valid schema."""
    response = client.get("/analyze/RELIANCE/quote")
    assert response.status_code == 200
    data = response.json()
    assert data["ticker"] == "RELIANCE.NS"
    assert "price" in data
    assert "change" in data
    assert "change_pct" in data
    assert "is_market_open" in data


def test_analyze_ticker_with_timeframe():
    """Verify that the analysis route accepts custom timeframe intervals."""
    response = client.get("/analyze/RELIANCE?timeframe=5m")
    assert response.status_code == 200
    data = response.json()
    assert data["ticker"] == "RELIANCE.NS"
    assert data["metadata"] is not None

