import threading
import time
import pytest
from fastapi.testclient import TestClient
from api.api import create_app
from api.routers import market_opportunities

app = create_app()
client = TestClient(app)

# The full scan (20 stocks, real yfinance downloads + the whole analysis
# pipeline) genuinely takes tens of seconds - these tests exercise the
# non-blocking contract (the request itself must return fast, `computing`
# must be accurate), not the scan's own correctness, which is exercised via
# the shared _run_deterministic_pipeline pipeline elsewhere in the suite.
RESPONSE_TIME_BUDGET_SECONDS = 5.0


@pytest.fixture(autouse=True)
def stub_background_scan(monkeypatch):
    """Replace the real scan with a stub. Left running, the real daemon
    thread outlives the test session and fails mid-scan at interpreter
    shutdown ("cannot schedule new futures after interpreter shutdown")."""
    scan_started = threading.Event()

    def _fake_scan(*args, **kwargs):
        scan_started.set()
        with market_opportunities._scan_lock:
            market_opportunities._scan_in_progress = False

    monkeypatch.setattr(market_opportunities, "_compute_top_opportunities", _fake_scan)
    monkeypatch.setattr(market_opportunities, "_scan_in_progress", False)
    return scan_started


def test_get_top_opportunities_endpoint_is_non_blocking(stub_background_scan):
    """The request must return almost immediately regardless of scan state -
    it must never block on the actual scan (confirmed live: that reliably
    took 40s+ on Render's free-tier CPU, well past any HTTP timeout)."""
    start = time.time()
    response = client.get("/market/top-opportunities?limit=5")
    elapsed = time.time() - start

    assert response.status_code == 200, f"Expected 200 OK, got {response.status_code}: {response.text}"
    assert elapsed < RESPONSE_TIME_BUDGET_SECONDS, f"Endpoint took {elapsed:.1f}s - should return immediately, not block on the scan"
    if response.json()["computing"]:
        assert stub_background_scan.wait(timeout=2.0), "Endpoint reported computing=True but never started a background scan"

    data = response.json()
    assert "updated_at" in data
    assert "total_scanned" in data
    assert "opportunities" in data
    assert "computing" in data

    opps = data["opportunities"]
    assert isinstance(opps, list)
    assert len(opps) <= 5

    if len(opps) > 1:
        scores = [o["overall_score"] for o in opps]
        assert scores == sorted(scores, reverse=True), f"Expected sorted scores, got: {scores}"


def test_get_top_opportunities_second_call_also_non_blocking():
    """A second call (whether it lands on a still-empty cache or a cache
    hit) must also return immediately."""
    start = time.time()
    response = client.get("/market/top-opportunities?limit=3")
    elapsed = time.time() - start

    assert response.status_code == 200
    assert elapsed < RESPONSE_TIME_BUDGET_SECONDS, f"Endpoint took {elapsed:.1f}s on a second call - should still be immediate"
    assert len(response.json()["opportunities"]) <= 3
