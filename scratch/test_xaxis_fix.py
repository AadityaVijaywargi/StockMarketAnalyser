import sys
import os
import datetime

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from analysis.downloader import YahooDownloader

def test_xaxis_fix():
    print("==================================================")
    print(" TESTING PROPOSED X-AXIS FIX                     ")
    print("==================================================")

    downloader = YahooDownloader()
    df = downloader.download_ticker_data("RELIANCE.NS", interval="5m", period="1d")

    # API returns ISO strings with explicit IST offset: YYYY-MM-DDTHH:MM:SS+05:30
    api_dates = [idx.strftime("%Y-%m-%d %H:%M:%S") for idx in df.index[:20]]

    print("\n1. Simulating Frontend ISO String Parsing with IST Offset:")
    parsed_unix_timestamps = []
    for i, raw_date in enumerate(api_dates):
        # Convert "2026-07-29 09:15:00" -> "2026-07-29T09:15:00+05:30"
        iso_str = raw_date.replace(" ", "T") + "+05:30"
        dt = datetime.datetime.fromisoformat(iso_str)
        unix_ts = int(dt.timestamp())
        parsed_unix_timestamps.append(unix_ts)
        print(f"  [{i:2d}] Raw: '{raw_date}' -> ISO: '{iso_str}' -> UNIX: {unix_ts}")

    # Verify all 20 timestamps are strictly unique & strictly increasing by 300s (5m)
    diffs = [parsed_unix_timestamps[i] - parsed_unix_timestamps[i-1] for i in range(1, len(parsed_unix_timestamps))]
    print("\n2. Checking Timestamp Differences (Expected: 300 seconds per 5m candle):")
    print(f"  Differences: {diffs}")
    assert all(d == 300 for d in diffs), "Timestamps are not strictly 300s apart!"
    print("  UNIQUENESS & STEP SIZES VERIFIED: PASS")

    print("\n3. Simulating Formatted Axis Labels:")
    formatted_labels = []
    for i, ts in enumerate(parsed_unix_timestamps):
        dt = datetime.datetime.fromtimestamp(ts, tz=datetime.timezone(datetime.timedelta(hours=5, minutes=30)))
        label = dt.strftime("%H:%M")
        formatted_labels.append(label)
        print(f"  [{i:2d}] UNIX {ts} -> IST Time Label: '{label}'")

    # Verify no adjacent labels are duplicated unexpectedly
    print("\n4. Label Verification:")
    print(f"  Labels: {formatted_labels[:10]}...")
    assert len(set(formatted_labels)) == len(formatted_labels), "Found duplicate labels!"
    print("  ZERO DUPLICATE LABELS: PASS")

    print("\n==================================================")
    print(" PROPOSED FIX VERIFIED SUCCESSFULLY!             ")
    print("==================================================")

if __name__ == "__main__":
    test_xaxis_fix()
