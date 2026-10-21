"""The paper bot decides on completed daily bars only (yesterday's close), never today's forming bar."""
from datetime import date, datetime

import pandas as pd
import pytz

from api import paper_bot, paper_store
from api.routers import analysis
from api.routers.analysis import _completed_bars

IST = pytz.timezone("Asia/Kolkata")


def _frame(index):
    return pd.DataFrame({"Close": range(len(index))}, index=index)


def test_completed_bars_drops_today_naive_index():
    df = _frame(pd.to_datetime(["2026-10-19", "2026-10-20", "2026-10-21"]))
    out = _completed_bars(df, today=date(2026, 10, 21))
    assert list(out.index.strftime("%Y-%m-%d")) == ["2026-10-19", "2026-10-20"]


def test_completed_bars_uses_market_date_for_tz_aware_index():
    # 21 Oct 00:00 IST is still 20 Oct in UTC; the market date is what counts.
    idx = pd.DatetimeIndex([IST.localize(datetime(2026, 10, d)) for d in (20, 21)]).tz_convert("UTC")
    out = _completed_bars(_frame(idx), today=date(2026, 10, 21))
    assert len(out) == 1 and out.index[0].tz_convert(IST).day == 20


def test_completed_bars_keeps_everything_before_the_session_bar_exists():
    df = _frame(pd.to_datetime(["2026-10-19", "2026-10-20"]))
    assert len(_completed_bars(df, today=date(2026, 10, 21))) == 2


def test_get_signal_asks_for_previous_close_and_caches_per_day(monkeypatch):
    calls = []

    def fake_pipeline(**kwargs):
        calls.append(kwargs)
        return {"trade_signal": {"signal_type": "WAIT", "n": len(calls)}}

    monkeypatch.setattr(analysis, "_run_deterministic_pipeline", fake_pipeline)
    for name in ("get_downloader", "get_cache", "get_live_cache", "get_report_generator",
                 "get_feature_store", "get_scorer", "get_market_downloader"):
        monkeypatch.setattr(paper_bot.deps, name, lambda: None)
    paper_bot._signal_cache.clear()

    day = [IST.localize(datetime(2026, 10, 20, 9, 20))]
    monkeypatch.setattr(paper_store, "market_now", lambda: day[0])

    first = paper_bot.get_signal("TCS.NS")
    assert paper_bot.get_signal("TCS.NS") is first  # same day: no recompute
    assert len(calls) == 1 and calls[0]["as_of_previous_close"] is True

    day[0] = IST.localize(datetime(2026, 10, 21, 9, 20))
    assert paper_bot.get_signal("TCS.NS")["n"] == 2  # new day: fresh signal
    assert list(paper_bot._signal_cache) == [("TCS.NS", date(2026, 10, 21))]


def test_get_signal_failure_is_not_cached(monkeypatch):
    def boom(**kwargs):
        raise RuntimeError("network")

    monkeypatch.setattr(analysis, "_run_deterministic_pipeline", boom)
    for name in ("get_downloader", "get_cache", "get_live_cache", "get_report_generator",
                 "get_feature_store", "get_scorer", "get_market_downloader"):
        monkeypatch.setattr(paper_bot.deps, name, lambda: None)
    paper_bot._signal_cache.clear()
    monkeypatch.setattr(paper_store, "market_now", lambda: IST.localize(datetime(2026, 10, 20, 9, 20)))
    assert paper_bot.get_signal("TCS.NS") is None
    assert paper_bot._signal_cache == {}


def test_atr14_from_chart_data():
    # Constant 10-point daily range, no gaps -> ATR 10.
    n = 30
    chart = {"high": [105.0] * n, "low": [95.0] * n, "close": [100.0] * n}
    assert paper_bot._atr14(chart) == 10.0
    assert paper_bot._atr14({"high": [1.0] * 5, "low": [0.5] * 5, "close": [0.8] * 5}) is None
    assert paper_bot._atr14({}) is None
