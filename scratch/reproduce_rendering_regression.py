import sys
import os
import datetime

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from analysis.downloader import YahooDownloader

def trace_rendering_pipeline():
    print("==================================================")
    print(" STAGE-BY-STAGE RENDERING PIPELINE TRACE         ")
    print("==================================================")

    downloader = YahooDownloader()
    df = downloader.download_ticker_data("RELIANCE.NS", interval="1d", period="1y")

    # STAGE 1: API Response
    dates_api = [idx.strftime("%Y-%m-%d") for idx in df.index]
    opens = df["Open"].round(2).tolist()
    highs = df["High"].round(2).tolist()
    lows = df["Low"].round(2).tolist()
    closes = df["Close"].round(2).tolist()
    volumes = df["Volume"].astype(int).tolist()

    print(f"\n[STAGE 1] Raw API Response:")
    print(f"  Count: {len(dates_api)}")
    print(f"  First candle: Date={dates_api[0]}, Open={opens[0]}, High={highs[0]}, Low={lows[0]}, Close={closes[0]}")
    print(f"  Last candle:  Date={dates_api[-1]}, Open={opens[-1]}, High={highs[-1]}, Low={lows[-1]}, Close={closes[-1]}")

    # STAGE 2: ChartDataAdapter.adaptPayload
    candle_map = {}
    for d, o, h, l, c, v in zip(dates_api, opens, highs, lows, closes, volumes):
        time_val = d.split(" ")[0].split("T")[0]
        candle_map[time_val] = {
            "time": time_val,
            "open": o,
            "high": h,
            "low": l,
            "close": c,
            "volume": v
        }

    adapted_candles = list(candle_map.values())
    print(f"\n[STAGE 2] Parsed & Normalized Candles:")
    print(f"  Count: {len(adapted_candles)}")
    print(f"  First candle: {adapted_candles[0]}")
    print(f"  Last candle:  {adapted_candles[-1]}")

    # STAGE 3: TradingSessionManager.filterTradingSessions
    # For daily data (isIntraday = False), TradingSessionManager returns candles directly.
    # But for intraday data, let's trace 5M candles!
    df_5m = downloader.download_ticker_data("RELIANCE.NS", interval="5m", period="1d")
    dates_5m = [idx.strftime("%Y-%m-%d %H:%M:%S") for idx in df_5m.index]
    opens_5m = df_5m["Open"].round(2).tolist()

    print(f"\n[STAGE 3] Intraday 5M Candles Trace:")
    print(f"  Raw 5M count: {len(dates_5m)}")
    print(f"  First 5M candle: Date={dates_5m[0]}, Open={opens_5m[0]}")

    # Simulate JavaScript filter:
    filtered_5m = []
    for d_str in dates_5m:
        # UNIX timestamp in seconds
        dt_obj = datetime.datetime.strptime(d_str, "%Y-%m-%d %H:%M:%S")
        hours = dt_obj.hour
        minutes = dt_obj.minute
        total_mins = hours * 60 + minutes
        if 555 <= total_mins <= 930:
            filtered_5m.append(d_str)

    print(f"  Filtered 5M candle count: {len(filtered_5m)}")
    assert len(filtered_5m) > 0, "Intraday filtering resulted in 0 candles!"
    print(f"  First filtered 5M candle: {filtered_5m[0]}")
    print(f"  Last filtered 5M candle:  {filtered_5m[-1]}")

    print("\n==================================================")
    print(" PIPELINE TRACE COMPLETED CLEANLY                 ")
    print("==================================================")

if __name__ == "__main__":
    trace_rendering_pipeline()
