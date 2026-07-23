import os
import sys

# Add root folder to sys.path so we can import modules
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from fastapi.testclient import TestClient
from api.api import create_app

app = create_app()
client = TestClient(app)

tickers = ["RELIANCE.NS", "TCS.NS", "INFY.NS", "HDFCBANK.NS"]

print("=========================================================")
print("MANUAL VERIFICATION OF DETERMINISTIC PIPELINE VIA REST API")
print("=========================================================")

for ticker in tickers:
    print(f"\nAnalyzing {ticker}...")
    try:
        response = client.get(f"/analyze/{ticker}?debug=true")
        if response.status_code == 200:
            data = response.json()
            print(f"  [SUCCESS] {ticker}")
            print(f"  Company Name:   {data['company_name']}")
            print(f"  Analysis Date:  {data['analysis_date']}")
            print(f"  Overall Score:  {data['scores']['overall_score']:.2f}")
            print(f"  Recommendation: {data['scores']['recommendation']}")
            print(f"  Risk Level:     {data['risk_profile']['level']}")
            print(f"  Market Trend:   {data['market_context']['nifty']['direction']}")
            print(f"  Volatility:     {data['market_context']['vix']['regime']}")
            print(f"  Positive Facs:  {len(data['positive_factors'])}")
            print(f"  Negative Facs:  {len(data['negative_factors'])}")
            print(f"  Total Time:     {data['metadata']['timings']['total_pipeline_time_ms']} ms")
        else:
            print(f"  [FAILED] status code: {response.status_code}")
            print(f"  Detail: {response.json().get('detail')}")
    except Exception as e:
        print(f"  [ERROR] Exception occurred: {str(e)}")

print("\n=========================================================")
print("Manual verification completed.")
print("=========================================================")
