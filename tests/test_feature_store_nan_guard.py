import numpy as np
import pandas as pd
import pytest

from analysis.scoring import RuleBasedScorer


def _make_uptrend_features_df(rows: int = 40) -> pd.DataFrame:
    """A clean, steadily rising price series with enough signal that a
    correct scoring pass should not land on exactly 0 for every category."""
    dates = pd.date_range("2026-01-01", periods=rows, freq="D")
    close = np.linspace(100.0, 130.0, rows)
    return pd.DataFrame({
        "Close": close,
        "High": close * 1.01,
        "Low": close * 0.99,
        "Volume": [1_000_000] * rows,
        "Relative_Volume": [1.2] * rows,
        "RSI_14": np.linspace(45.0, 65.0, rows),
        "Hist_Vol_20": [18.0] * rows,
        "ATR_14": close * 0.015,
    }, index=dates)


def _market_context() -> dict:
    return {
        "nifty": {"direction": "BULLISH", "strength": 60.0},
        "vix": {"vix_value": 14.0, "regime": "Normal"},
        "relative_strength_rating": 60.0,
        "stock_beta": 1.0,
        "stock_correlation": 0.7,
    }


def test_ghost_nan_row_does_not_crash_or_leak_nan():
    """
    Documents the mechanism of two real bugs found via this exact scenario:
    the Feature Store persists an incrementally outer-joined per-ticker
    history, and a stale row from an earlier session (e.g. a synthetic
    future date with no real OHLCV) can linger in that index forever.
    Since every "current row" lookup in this codebase is
    features_df.iloc[-1], a ghost row sorting last (with every column NaN)
    gets treated as "today". That used to (a) raise UnboundLocalError from
    scoring.py's volatility block when a NaN-valued indicator column
    existed but its last value didn't, and (b) leak a literal NaN into
    RiskProfile.atr_percentage (rendered as "ATR Buffer: nan%" in the UI)
    since that field had no NaN guard, unlike ScoreComponent's.

    The pipeline-level fix (dropping any row without a valid Close before
    scoring) is covered separately below; this test guards the scorer
    itself against ever regressing back to crashing or leaking NaN when
    fed a row it shouldn't have to trust in the first place.
    """
    df = _make_uptrend_features_df()

    # Simulate the ghost row: a future date appended with no real price data,
    # exactly what an outer join against a stale cached Parquet produces.
    ghost_date = df.index[-1] + pd.Timedelta(days=49)
    ghost_row = pd.DataFrame({col: [np.nan] for col in df.columns}, index=[ghost_date])
    poisoned_df = pd.concat([df, ghost_row])

    scorer = RuleBasedScorer()
    # Must not raise (regression guard for the UnboundLocalError bug).
    scores, risk, _, _, _ = scorer.calculate_scores(poisoned_df, _market_context())

    # Must not leak NaN into user-facing fields (regression guard for the
    # unguarded atr_percent/RiskProfile.atr_percentage bug).
    assert not np.isnan(risk.atr_percentage)
    assert not np.isnan(risk.annualized_volatility)


def test_filtering_nan_close_rows_before_scoring_fixes_it():
    """
    The actual fix, applied at the single shared pipeline entry point
    (api/routers/analysis.py, _run_deterministic_pipeline): drop any row
    without a valid Close before it's used for anything. Verifies that
    filter alone is sufficient to restore correct, non-degenerate scores
    on the exact same poisoned data as the test above.
    """
    df = _make_uptrend_features_df()
    ghost_date = df.index[-1] + pd.Timedelta(days=49)
    ghost_row = pd.DataFrame({col: [np.nan] for col in df.columns}, index=[ghost_date])
    poisoned_df = pd.concat([df, ghost_row])

    # The fix: exactly the filter used in the real pipeline.
    clean_df = poisoned_df[poisoned_df["Close"].notna()]

    scorer = RuleBasedScorer()
    scores, _, _, _, _ = scorer.calculate_scores(clean_df, _market_context())

    assert scores.trend.value > 0.0
    assert scores.momentum.value > 0.0
    assert scores.volatility.value > 0.0
    assert scores.overall_score > 0.0
