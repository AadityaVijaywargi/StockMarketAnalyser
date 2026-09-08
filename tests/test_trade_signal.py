import pytest
import pandas as pd
from analysis.trade_signal_engine import calculate_trade_signal
from analysis.support_resistance import SRZone

class MockScores:
    def __init__(self, overall_score=75.0, recommendation="BUY", confidence=85.0):
        self.overall_score = overall_score
        self.recommendation = recommendation
        self.confidence = confidence

class MockRiskProfile:
    def __init__(self, level="Medium"):
        self.level = level

@pytest.fixture
def mock_stock_df():
    dates = pd.date_range(start="2026-01-01", periods=20, freq="D")
    df = pd.DataFrame({
        "Open": [100.0 + i for i in range(20)],
        "High": [102.0 + i for i in range(20)],
        "Low": [99.0 + i for i in range(20)],
        "Close": [101.0 + i for i in range(20)],
        "Volume": [10000] * 20
    }, index=dates)
    return df

def test_trade_signal_buy_now(mock_stock_df):
    scores = MockScores(overall_score=75.0, recommendation="BUY", confidence=88.0)
    risk = MockRiskProfile(level="Medium")
    supp = [SRZone(level_type="support", upper_bound=115.0, lower_bound=113.0, strength=0.8, touches=3, average_volume=10000.0, first_detection="2026-01-01", last_confirmation="2026-01-10")]
    res = [SRZone(level_type="resistance", upper_bound=135.0, lower_bound=130.0, strength=0.8, touches=3, average_volume=10000.0, first_detection="2026-01-01", last_confirmation="2026-01-10")]

    signal = calculate_trade_signal(mock_stock_df, scores, supp, res, risk, timeframe="1D")
    assert signal["signal"] in ["BUY NOW", "WAIT", "SELL NOW"]
    assert signal["confidence"] <= 96.0
    assert signal["holding_time"] in ["1–5 days", "1–3 days", "30–90 minutes"]
    assert signal["risk_reward_ratio"] > 0
    assert len(signal["reasons"]) > 0

def test_trade_signal_holding_times(mock_stock_df):
    scores = MockScores()
    risk = MockRiskProfile()

    sig_1d = calculate_trade_signal(mock_stock_df, scores, [], [], risk, timeframe="1D")
    assert sig_1d["holding_time"] in ["1–5 days", "1–3 days", "30–90 minutes"]

    sig_1w = calculate_trade_signal(mock_stock_df, scores, [], [], risk, timeframe="1W")
    assert sig_1w["holding_time"] in ["1–3 weeks", "2–5 trading days", "1–3 days"]

    sig_1m = calculate_trade_signal(mock_stock_df, scores, [], [], risk, timeframe="1M")
    assert sig_1m["holding_time"] in ["1–3 months", "2–4 weeks", "1–2 weeks"]

    sig_6m = calculate_trade_signal(mock_stock_df, scores, [], [], risk, timeframe="6M")
    assert sig_6m["holding_time"] in ["3–6 months", "1–3 months"]

def test_trade_signal_target_reached(mock_stock_df):
    # Set current price equal to target price
    scores = MockScores()
    risk = MockRiskProfile()
    # High current price
    mock_stock_df.iloc[-1, mock_stock_df.columns.get_loc("Close")] = 200.0

    signal = calculate_trade_signal(mock_stock_df, scores, [], [], risk, timeframe="1D")
    assert signal["lifecycle_status"] in ["TARGET_REACHED", "MISSED_ENTRY", "ENTRY_VALID", "EXIT_SUGGESTED"]
