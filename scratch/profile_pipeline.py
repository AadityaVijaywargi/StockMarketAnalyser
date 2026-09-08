import sys
import os
import time

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from fastapi.testclient import TestClient
from api.api import create_app

app = create_app()
client = TestClient(app)

def profile_batch_pipeline():
    tickers = [
        "RELIANCE.NS", "TCS.NS", "INFY.NS", "HDFCBANK.NS", "ICICIBANK.NS",
        "BHARTIARTL.NS", "SBIN.NS", "ITC.NS", "KOTAKBANK.NS", "LT.NS",
        "AXISBANK.NS", "HINDUNILVR.NS", "MARUTI.NS", "SUNPHARMA.NS", "TITAN.NS", "ULTRACEMCO.NS"
    ]

    print("==================================================")
    print("  WATCHLIST MONITOR PIPELINE PERFORMANCE PROFILING ")
    print("==================================================")
    print(f"Profiling batch refresh for {len(tickers)} stocks...\n")

    t_start = time.time()
    payload = {"tickers": tickers, "horizon": "1d"}
    
    t0 = time.time()
    res = client.post("/analyze/watchlist-predictions", json=payload)
    t_total = time.time() - t0

    print(f"Call 1 (Cold Execution):        {t_total:.2f} seconds")

    t1 = time.time()
    res2 = client.post("/analyze/watchlist-predictions", json=payload)
    t_total2 = time.time() - t1

    print(f"Call 2 (Enriched Feature Cache): {t_total2:.3f} seconds ({t_total2*1000/len(tickers):.1f} ms per stock!)")

if __name__ == "__main__":
    profile_batch_pipeline()
