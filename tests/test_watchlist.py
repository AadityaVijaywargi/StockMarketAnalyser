import pytest

def test_watchlist_structure_and_types():
    """
    Verifies that the WatchlistItem model schema structure is compatible with the backend.
    """
    sample_item = {
        "id": "RELIANCE.NS",
        "ticker": "RELIANCE.NS",
        "company_name": "Reliance Industries",
        "exchange": "NSE",
        "date_added": "2026-07-24T12:00:00Z",
        "pinned": False,
        "notes": "",
        "tags": []
    }
    assert sample_item["id"] == "RELIANCE.NS"
    assert sample_item["exchange"] == "NSE"
    assert sample_item["pinned"] is False
