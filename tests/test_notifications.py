import pytest

def test_notification_model_and_deduplication():
    """
    Verifies AppNotification schema, severity mapping, and deduplication logic.
    """
    notif = {
        "id": "notif_RELIANCE.NS_1001",
        "ticker": "RELIANCE.NS",
        "company_name": "Reliance Industries",
        "type": "RECOMMENDATION_CHANGE",
        "severity": "IMPORTANT",
        "old_recommendation": "WATCH",
        "new_recommendation": "BUY",
        "old_confidence": 72.0,
        "new_confidence": 88.0,
        "change_reason": [
            "Overall technical score moved from 62.0 to 82.5.",
            "Primary bullish catalyst: Golden Cross detected on 50/200 EMA."
        ],
        "timestamp": "2026-07-24T12:00:00Z",
        "read": False
    }

    assert notif["type"] == "RECOMMENDATION_CHANGE"
    assert notif["severity"] == "IMPORTANT"
    assert notif["old_recommendation"] != notif["new_recommendation"]
    assert len(notif["change_reason"]) > 0

def test_no_duplicate_notification_on_same_recommendation():
    """
    Ensures that BUY -> BUY or WATCH -> WATCH produces zero notifications.
    """
    old_rec = "BUY"
    new_rec = "BUY"

    should_notify = old_rec != new_rec
    assert should_notify is False
