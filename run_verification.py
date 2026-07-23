import time
import json
from api.api import create_app
from fastapi.testclient import TestClient

def run_verification():
    app = create_app()
    client = TestClient(app)
    
    tickers = ["RELIANCE.NS", "TCS.NS", "INFY.NS", "HDFCBANK.NS", "SBIN.NS"]
    
    print("\n=========================================================")
    print("UPGRADED SCORING ENGINE - PIPELINE VERIFICATION RUN")
    print("=========================================================\n")
    
    for ticker in tickers:
        print(f"Running analysis for {ticker}...")
        t0 = time.time()
        
        response = client.get(f"/analyze/{ticker}")
        
        if response.status_code == 200:
            data = response.json()
            scores = data["scores"]
            risk = data["risk_profile"]
            meta = data.get("metadata", {})
            explanation = meta.get("scoring_explanation", {})
            
            elapsed = (time.time() - t0) * 1000
            
            print(f"Result for {ticker}:")
            print(f"  - Recommendation : {scores['recommendation']}")
            print(f"  - Overall Score  : {scores['overall_score']:.2f}")
            print(f"  - Confidence     : {scores['confidence']:.2f}%")
            print(f"  - Risk Profile   : {risk['level']}")
            print(f"  - Market Regime  : {explanation.get('regime', 'N/A').upper()}")
            print(f"  - Applied Weights:")
            for cat, w in explanation.get('applied_weights', {}).items():
                print(f"      * {cat:17}: {w:.2f}")
            print(f"  - Active Signals:")
            sig = explanation.get('signal_agreement', {})
            print(f"      * Bullish      : {sig.get('bullish_signals', 0)}")
            print(f"      * Bearish      : {sig.get('bearish_signals', 0)}")
            print(f"  - Pipeline Time  : {elapsed:.1f}ms")
            print("-" * 50)
        else:
            print(f"Failed to analyze {ticker}: HTTP {response.status_code} - {response.text}")
            print("-" * 50)

if __name__ == "__main__":
    run_verification()
