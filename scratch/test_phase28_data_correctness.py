import sys
import os
from datetime import time as dt_time

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from analysis.downloader import YahooDownloader


def test_data_correctness_and_exchange_session_alignment():
    print("==================================================")
    print(" DATA CORRECTNESS & EXCHANGE SESSION VALIDATION   ")
    print("==================================================")

    tickers = ["INFY.NS", "RELIANCE.NS", "TCS.NS", "SBIN.NS", "HDFCBANK.NS"]
    downloader = YahooDownloader()

    for ticker in tickers:
        print(f"\nAuditing exchange data correctness for {ticker}...")
        df = downloader.download_ticker_data(ticker, interval="5m", period="5d")
        assert df is not None and not df.empty, f"No data for {ticker}"

        # 1. Verify Timezone & Exchange Session Hours: Mon-Fri, 09:15 to 15:30 IST
        invalid_overnight = 0
        invalid_weekend = 0

        for idx in df.index:
            # Check weekend
            if idx.weekday() >= 5:
                invalid_weekend += 1

            # Check trading hours: 09:15 to 15:30 IST
            t = idx.time()
            if t < dt_time(9, 15) or t > dt_time(15, 30):
                invalid_overnight += 1

        assert invalid_weekend == 0, f"Found {invalid_weekend} weekend candles for {ticker}"
        assert invalid_overnight == 0, f"Found {invalid_overnight} overnight candles for {ticker}"

        print(f"  Total candles: {len(df)}")
        print(f"  First candle:  {df.index[0]}")
        print(f"  Last candle:   {df.index[-1]}")
        print(f"  Overnight candles: 0 [PASS]")
        print(f"  Weekend candles:   0 [PASS]")
        print(f"  Status: VERIFIED_EXCHANGE_SESSION_ALIGNMENT [PASS]")

    print("\n==================================================")
    print(" All Data Correctness Tests Passed Cleanly!      ")
    print("==================================================")


if __name__ == "__main__":
    test_data_correctness_and_exchange_session_alignment()
