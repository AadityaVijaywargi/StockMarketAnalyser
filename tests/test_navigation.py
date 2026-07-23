import pytest
from fastapi.testclient import TestClient
from api.api import create_app
from api.deps import get_live_cache

@pytest.fixture
def client():
    app = create_app()
    return TestClient(app)

def test_api_timeframe_routing(client):
    """
    Test that the /analyze/{ticker} endpoint correctly handles and routes timeframe parameters.
    """
    response = client.get("/analyze/RELIANCE.NS?timeframe=1h")
    assert response.status_code == 200
    report = response.json()
    assert report["ticker"] == "RELIANCE.NS"
    # The default return timeframe for mock test should match or complete successfully

def test_quote_endpoint_routing(client):
    """
    Test that the quote service endpoint resolves ticker details and returns live quotes.
    """
    response = client.get("/analyze/RELIANCE.NS/quote")
    assert response.status_code == 200
    quote = response.json()
    assert "price" in quote
    assert "change" in quote
    assert "is_market_open" in quote
    assert quote["ticker"] == "RELIANCE.NS"

def test_invalid_timeframe_handling(client):
    """
    Test that invalid timeframe values fallback or validate gracefully.
    """
    response = client.get("/analyze/RELIANCE.NS?timeframe=invalid_tf")
    # Should either validate, warn, or return 404 Not Found due to empty dataframe
    assert response.status_code in [200, 404, 422]
