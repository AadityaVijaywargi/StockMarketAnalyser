import pytest
import pandas as pd
from types import SimpleNamespace

from analysis.prediction_engine import DeterministicPredictionEngine


def _make_scores(value: float):
    """Builds a minimal scores stub with every category at the same value,
    so the resulting weighted probability is easy to reason about."""
    component = SimpleNamespace(value=value)
    return SimpleNamespace(
        overall_score=value,
        trend=component,
        momentum=component,
        volume=component,
        market=component,
        sector=component,
        volatility=component,
    )


def _make_features_df(close: float = 1000.0, atr: float = 20.0) -> pd.DataFrame:
    dates = pd.date_range("2026-01-01", periods=5)
    return pd.DataFrame({
        "Close": [close] * 5,
        "ATR_14": [atr] * 5,
    }, index=dates)


@pytest.fixture
def engine():
    return DeterministicPredictionEngine()


@pytest.fixture
def risk():
    return SimpleNamespace(level="Moderate")


def test_down_direction_target_and_stop_are_not_equal(engine, risk):
    """
    Regression test for a real bug: DOWN-direction predictions previously
    used abs(move_pct) for both target and stop, collapsing them to the
    exact same price (zero reward, R:R undefined). A bearish call must
    produce a target BELOW current price and a stop ABOVE it.
    """
    scores = _make_scores(20.0)  # uniformly weak -> low probability -> DOWN
    features_df = _make_features_df(close=1000.0, atr=20.0)

    result = engine.predict(
        ticker="TEST.NS", horizon="1d", features_df=features_df,
        scores=scores, risk=risk, market_context={}, intelligence_pack=None
    )

    assert result.direction == "DOWN"
    assert result.target_price != result.stop_loss, "target and stop collapsed to the same price"
    assert result.target_price < 1000.0, "a bearish target should sit below current price"
    assert result.stop_loss > 1000.0, "a bearish stop should sit above current price (protects against a rally)"


def test_up_direction_target_and_stop_are_not_equal(engine, risk):
    scores = _make_scores(80.0)  # uniformly strong -> high probability -> UP
    features_df = _make_features_df(close=1000.0, atr=20.0)

    result = engine.predict(
        ticker="TEST.NS", horizon="1d", features_df=features_df,
        scores=scores, risk=risk, market_context={}, intelligence_pack=None
    )

    assert result.direction == "UP"
    assert result.target_price != result.stop_loss
    assert result.target_price > 1000.0, "a bullish target should sit above current price"
    assert result.stop_loss < 1000.0, "a bullish stop should sit below current price"


def test_neutral_direction_target_and_stop_are_not_equal(engine, risk):
    scores = _make_scores(50.0)  # balanced -> mid probability -> NEUTRAL
    features_df = _make_features_df(close=1000.0, atr=20.0)

    result = engine.predict(
        ticker="TEST.NS", horizon="1d", features_df=features_df,
        scores=scores, risk=risk, market_context={}, intelligence_pack=None
    )

    assert result.direction == "NEUTRAL"
    assert result.target_price != result.stop_loss
    assert result.stop_loss < result.target_price, "stop must always sit below target regardless of direction"
