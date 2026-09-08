import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from analysis.downloader import YahooDownloader

def diagnose_xaxis():
    print("==================================================")
    print(" X-AXIS TIMESTAMPS EMPIRICAL DIAGNOSTIC           ")
    print("==================================================")

    downloader = YahooDownloader()
    df = downloader.download_ticker_data("RELIANCE.NS", interval="5m", period="1d")

    print("\n1. Raw DataFrame Index (First 20 candles):")
    for i, idx in enumerate(df.index[:20]):
        print(f"  [{i:2d}] {type(idx).__name__}: {idx} (unix: {idx.timestamp() if hasattr(idx, 'timestamp') else 'N/A'})")

    # Simulate /historical-chart API date formatting
    dates_api = [idx.strftime("%Y-%m-%d %H:%M:%S") if hasattr(idx, "strftime") else str(idx) for idx in df.index[:20]]
    print("\n2. API Response dates field (First 20 candles):")
    for i, d in enumerate(dates_api):
        print(f"  [{i:2d}] '{d}'")

    # Now let's simulate frontend parsing logic in TechnicalChart.tsx!
    print("\n3. Frontend Parsed Times (First 20 candles):")
    parsed_times = []
    for i, d in enumerate(dates_api):
        let_time_val = d
        if isinstance(d, str):
            if ' ' in d or 'T' in d:
                # In JS: Date.parse(d.replace(' ', 'T')) / 1000
                import datetime
                # In JS, Date.parse("2026-07-29 09:15:00".replace(' ', 'T')) parse behavior:
                dt_obj = datetime.datetime.strptime(d, "%Y-%m-%d %H:%M:%S")
                # Wait! How does JS Date.parse("2026-07-29T09:15:00") handle timezone?!
                # In JS Date.parse("2026-07-29T09:15:00") without timezone offsets is treated as LOCAL time or UTC depending on browser/Vite!
                # BUT what about Lightweight Charts tickMarkFormatter?!
                let_time_val = int(dt_obj.timestamp())
        parsed_times.append(let_time_val)
        print(f"  [{i:2d}] Raw: '{d}' -> Parsed UNIX: {let_time_val}")

    print("\n4. Simulating tickMarkFormatter formatting:")
    import datetime
    for i, t in enumerate(parsed_times):
        # In JS tickMarkFormatter:
        # const d = new Date(time * 1000);
        # return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
        dt = datetime.datetime.fromtimestamp(t)
        formatted = dt.strftime("%H:%M")
        print(f"  [{i:2d}] UNIX {t} -> Formatted Label: '{formatted}'")

if __name__ == "__main__":
    diagnose_xaxis()
