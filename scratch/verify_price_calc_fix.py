import yfinance as yf
import math

def is_valid_num(val):
    if val is None:
        return False
    try:
        f = float(val)
        return not (math.isnan(f) or math.isinf(f)) and f > 0
    except Exception:
        return False

def _get_fast_info_num(fast, *keys):
    if fast is None:
        return None
    for k in keys:
        val = None
        try:
            if hasattr(fast, "__getitem__"):
                val = fast[k]
        except Exception:
            pass
        if not is_valid_num(val) and hasattr(fast, "get"):
            try:
                val = fast.get(k)
            except Exception:
                pass
        if not is_valid_num(val):
            try:
                val = getattr(fast, k, None)
            except Exception:
                pass
        if is_valid_num(val):
            return float(val)
    return None

def fetch_live_quote_fixed(ticker):
    ticker_obj = yf.Ticker(ticker)
    price = None
    prev_close = None
    high = None
    low = None
    volume = 0

    try:
        fast = ticker_obj.fast_info
        price = _get_fast_info_num(fast, "lastPrice", "last_price")
        prev_close = _get_fast_info_num(fast, "regularMarketPreviousClose", "regular_market_previous_close", "previousClose", "previous_close")
        high = _get_fast_info_num(fast, "dayHigh", "day_high")
        low = _get_fast_info_num(fast, "dayLow", "day_low")
        v = _get_fast_info_num(fast, "lastVolume", "last_volume")
        if v is not None:
            volume = int(v)
    except Exception as e:
        pass

    try:
        hist = ticker_obj.history(period="5d")
        if not hist.empty:
            hist = hist.dropna(subset=["Close", "High", "Low"])
            hist = hist[hist["Close"] > 0]
            if len(hist) >= 1:
                last_row = hist.iloc[-1]
                if not is_valid_num(price): price = float(last_row["Close"])
                if not is_valid_num(high): high = float(last_row["High"])
                if not is_valid_num(low): low = float(last_row["Low"])
                if volume <= 0 and "Volume" in last_row: volume = int(last_row["Volume"])
                if len(hist) >= 2:
                    official_prev = float(hist.iloc[-2]["Close"])
                    if is_valid_num(official_prev):
                        prev_close = official_prev
    except Exception as e:
        pass

    change = price - prev_close
    change_pct = (change / prev_close) * 100.0 if prev_close > 0 else 0.0

    return {
        "ticker": ticker,
        "price": round(float(price), 2),
        "prev_close": round(float(prev_close), 2),
        "change": round(float(change), 2),
        "change_pct": round(float(change_pct), 2),
        "high": round(float(high), 2),
        "low": round(float(low), 2)
    }

if __name__ == "__main__":
    for sym in ["TCS.NS", "RELIANCE.NS", "INFY.NS", "HDFCBANK.NS"]:
        q = fetch_live_quote_fixed(sym)
        print(f"{q['ticker']} -> Price: {q['price']}, PrevClose: {q['prev_close']}, Change: {q['change']} ({q['change_pct']}%)")
