import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from fastapi.testclient import TestClient
from api.api import create_app

app = create_app()
client = TestClient(app)


def test_chart_timeframes_and_data_contracts():
    print("==================================================")
    print(" PHASE 26 INSTITUTIONAL CHARTING VALIDATION       ")
    print("==================================================")

    ticker = "RELIANCE.NS"
    timeframes = ["5M", "10M", "30M", "1D", "1W", "1M", "6M", "1Y", "5Y", "MAX"]

    print(f"\n[1/2] Testing Historical Chart Endpoint /api/analysis/chart for {len(timeframes)} Timeframes...")

    for tf in timeframes:
        res = client.get(f"/analyze/{ticker}/chart?timeframe={tf}")
        assert res.status_code == 200, f"Expected 200 OK for {tf}, got {res.status_code}"
        data = res.json()
        
        assert "dates" in data, f"Missing dates for {tf}"
        assert "open" in data, f"Missing open for {tf}"
        assert "high" in data, f"Missing high for {tf}"
        assert "low" in data, f"Missing low for {tf}"
        assert "close" in data, f"Missing close for {tf}"
        assert "volume" in data, f"Missing volume for {tf}"
        
        count = len(data["dates"])
        print(f"  Timeframe {tf:4s} -> Returned {count:4d} OHLC candle points cleanly!")

    print("\n[2/2] All Phase 26 Charting Data Contract Tests Passed Cleanly!")
    print("==================================================")


if __name__ == "__main__":
    test_chart_timeframes_and_data_contracts()
