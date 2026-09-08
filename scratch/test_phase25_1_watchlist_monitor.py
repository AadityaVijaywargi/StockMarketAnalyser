import sys
import os
import time

# Add project root to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from fastapi.testclient import TestClient
from api.api import create_app

app = create_app()
client = TestClient(app)


def run_phase_25_1_watchlist_monitor_validation():
    print("==================================================")
    print(" PHASE 25.1 WATCHLIST BACKGROUND MONITOR ENGINE   ")
    print("==================================================")

    tickers = [
        "RELIANCE.NS", "TCS.NS", "INFY.NS", "HDFCBANK.NS", "ICICIBANK.NS",
        "BHARTIARTL.NS", "SBIN.NS", "LTIM.NS", "ITC.NS", "KOTAKBANK.NS"
    ]

    print(f"\n[1/4] Testing Batch Prediction Endpoint POST /analyze/watchlist-predictions for {len(tickers)} Watchlist Stocks...")
    t0 = time.time()
    payload = {"tickers": tickers, "horizon": "1d"}
    response = client.post("/analyze/watchlist-predictions", json=payload)
    t_elapsed = time.time() - t0

    assert response.status_code == 200, f"Expected 200 OK, got {response.status_code}"
    data = response.json()
    
    print(f"  Batch Response Status: 200 OK")
    print(f"  Total Monitored Stocks Returned: {len(data)} / {len(tickers)}")
    print(f"  Total Execution Time for Batch (Shared Benchmark): {t_elapsed:.2f}s")
    
    assert len(data) >= 8, f"Expected at least 8 valid stock predictions, got {len(data)}"

    # 2. Verify Single Source of Truth Structure per Monitored Stock
    print("\n[2/4] Verifying Single Source of Truth Output Contracts...")
    sample_ticker = list(data.keys())[0]
    sample = data[sample_ticker]
    
    print(f"  Sample Monitored Stock: {sample_ticker}")
    print(f"    - Quote Price:        INR {sample['quote']['price']}")
    print(f"    - 24h Change:         {sample['quote']['change_pct']}%")
    print(f"    - Recommendation:     {sample['prediction']['recommendation']}")
    print(f"    - Probability:        {sample['prediction']['probability']}%")
    print(f"    - Confidence:         {sample['prediction']['confidence']}%")
    print(f"    - Target / Stop:      INR {sample['prediction']['target_price']} / INR {sample['prediction']['stop_loss']}")
    print(f"    - Event Override:     {sample['prediction']['event_override_applied']}")

    assert "quote" in sample, "Missing quote"
    assert "prediction" in sample, "Missing prediction"
    assert sample["prediction"]["recommendation"] in ["STRONG BUY", "BUY", "ACCUMULATE", "HOLD", "REDUCE", "SELL", "STRONG SELL"]

    # 3. Test Cached Benchmark Performance (Second Call)
    print("\n[3/4] Testing Cached Batch Execution Performance...")
    t1 = time.time()
    response2 = client.post("/analyze/watchlist-predictions", json=payload)
    t_elapsed2 = time.time() - t1
    print(f"  Second Batch Request Time (Cached Index Data): {t_elapsed2:.2f}s")
    assert response2.status_code == 200

    print("\n[4/4] All Phase 25.1 Background Monitor Tests Passed Cleanly!")
    print("==================================================")


if __name__ == "__main__":
    run_phase_25_1_watchlist_monitor_validation()
