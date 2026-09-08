import pytest
from fastapi.testclient import TestClient
from api.api import create_app

app = create_app()
client = TestClient(app)

def test_chart_timeframes_endpoint_all_options():
    """
    Verifies that GET /analyze/{ticker}/chart returns historical OHLC chart data for all 9 supported timeframes.
    """
    ticker = "RELIANCE.NS"
    timeframes = ["1D", "1W", "1M", "3M", "6M", "1Y", "3Y", "5Y", "MAX"]

    for tf in timeframes:
        response = client.get(f"/analyze/{ticker}/chart", params={"timeframe": tf})
        assert response.status_code == 200, f"Failed for timeframe {tf}"
        data = response.json()
        assert data["ticker"] == ticker
        assert data["timeframe"] == tf
        assert len(data["dates"]) > 0
        assert len(data["close"]) == len(data["dates"])
        assert len(data["high"]) == len(data["dates"])
        assert len(data["low"]) == len(data["dates"])
        assert len(data["volume"]) == len(data["dates"])
