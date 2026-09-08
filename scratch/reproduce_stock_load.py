import sys
import os
import traceback

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from fastapi.testclient import TestClient
from api.api import create_app

app = create_app()
client = TestClient(app)

def test_stock_loading():
    tickers = ["RELIANCE.NS", "INFY.NS", "TCS.NS", "HDFCBANK.NS", "^NSEI"]
    
    print("==================================================")
    print("  REPRODUCING STOCK LOADING IN BACKEND PIPELINE   ")
    print("==================================================")
    
    for t in tickers:
        print(f"\n[Testing] GET /analyze/{t} ...")
        try:
            res = client.get(f"/analyze/{t}")
            print(f"  Status Code: {res.status_code}")
            if res.status_code != 200:
                print(f"  Error Detail: {res.text}")
            else:
                data = res.json()
                print(f"  SUCCESS! Ticker: {data.get('ticker')}, Chart Dates: {len(data.get('chart_data', {}).get('dates', []))}")
        except Exception as e:
            print(f"  EXCEPTION THROWN: {e}")
            traceback.print_exc()

if __name__ == "__main__":
    test_stock_loading()
