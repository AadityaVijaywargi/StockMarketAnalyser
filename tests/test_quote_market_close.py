import pytest
from fastapi.testclient import TestClient
from api.api import create_app
from analysis.normalizer import TickerNormalizer
from analysis.cache import InMemoryLiveCache
from api.routers.analysis import fetch_live_quote

app = create_app()
client = TestClient(app)

TARGET_TICKERS = [
    "RELIANCE",
    "TCS",
    "INFY",
    "HDFCBANK",
    "ICICIBANK",
    "SBIN",
    "ITC",
    "LT",
    "SUNPHARMA",
    "TITAN"
]

def test_generic_ticker_normalization():
    """Verify that lower-case, upper-case, and .NS suffix variations resolve correctly."""
    variations = [
        ("reliance", "RELIANCE.NS"),
        ("RELIANCE", "RELIANCE.NS"),
        ("reliance.ns", "RELIANCE.NS"),
        ("RELIANCE.NS", "RELIANCE.NS"),
        ("tcs", "TCS.NS"),
        ("TCS.NS", "TCS.NS"),
        ("infy", "INFY.NS"),
        ("hdfcbank", "HDFCBANK.NS"),
        ("icicibank", "ICICIBANK.NS"),
        ("sbin", "SBIN.NS"),
        ("itc", "ITC.NS"),
        ("lt", "LT.NS"),
        ("sunpharma", "SUNPHARMA.NS"),
        ("titan", "TITAN.NS")
    ]
    for inp, expected in variations:
        assert TickerNormalizer.normalize(inp) == expected, f"Failed to normalize {inp}"


def test_quote_market_close_display_all_major_stocks():
    """Verify that quote endpoint returns valid non-zero price, high, low, volume for major stocks."""
    lc = InMemoryLiveCache()
    for symbol in TARGET_TICKERS:
        norm = TickerNormalizer.normalize(symbol)
        quote = fetch_live_quote(norm, lc)
        assert quote["price"] > 0.0, f"Invalid price for {symbol}: {quote['price']}"
        assert quote["high"] > 0.0, f"Invalid high for {symbol}: {quote['high']}"
        assert quote["low"] > 0.0, f"Invalid low for {symbol}: {quote['low']}"
        assert quote["volume"] >= 0, f"Invalid volume for {symbol}: {quote['volume']}"
        assert isinstance(quote["is_market_open"], bool)


def test_quote_api_endpoints_major_stocks():
    """Verify GET /analyze/{ticker}/quote returns HTTP 200 with valid data."""
    for symbol in TARGET_TICKERS:
        response = client.get(f"/analyze/{symbol}/quote")
        assert response.status_code == 200, f"Quote endpoint failed for {symbol}: {response.text}"
        data = response.json()
        assert data["price"] > 0.0, f"API returned non-positive price for {symbol}"
        assert data["high"] > 0.0, f"API returned non-positive high for {symbol}"
        assert data["low"] > 0.0, f"API returned non-positive low for {symbol}"
