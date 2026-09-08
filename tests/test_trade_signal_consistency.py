import pytest
import pandas as pd
from analysis.trade_signal_engine import calculate_trade_signal, validate_trade_signal_consistency
from analysis.support_resistance import SRZone

class DummyScores:
    def __init__(self, overall_score=35.0, recommendation="SELL", confidence=85.0):
        self.overall_score = overall_score
        self.recommendation = recommendation
        self.confidence = confidence

class DummyRiskProfile:
    def __init__(self, level="High"):
        self.level = level

def test_sell_now_signal_consistency():
    # Construct a stock dataframe
    dates = pd.date_range(end=pd.Timestamp.now(), periods=50, freq='D')
    df = pd.DataFrame({
        "Open": [750.0] * 50,
        "High": [755.0] * 50,
        "Low": [740.0] * 50,
        "Close": [742.80] * 50,
        "Volume": [100000] * 50
    }, index=dates)

    scores = DummyScores(overall_score=35.0, recommendation="SELL", confidence=85.0)
    risk = DummyRiskProfile()
    support = [
        SRZone(
            upper_bound=735.0, 
            lower_bound=730.0, 
            strength=0.8, 
            touches=3, 
            average_volume=100000.0, 
            first_detection="2026-01-01", 
            last_confirmation="2026-07-20", 
            level_type="support"
        )
    ]
    resistance = [
        SRZone(
            upper_bound=765.0, 
            lower_bound=760.0, 
            strength=0.8, 
            touches=3, 
            average_volume=100000.0, 
            first_detection="2026-01-01", 
            last_confirmation="2026-07-20", 
            level_type="resistance"
        )
    ]

    signal_dict = calculate_trade_signal(df, scores, support, resistance, risk, timeframe="1D")

    # VERIFY STATE MACHINE CONSISTENCY
    assert signal_dict["signal"] == "SELL NOW"
    assert signal_dict["entry_zone_low"] is None, "SELL NOW signal must NOT contain an Entry Zone"
    assert signal_dict["entry_zone_high"] is None, "SELL NOW signal must NOT contain an Entry Zone"
    assert signal_dict["target_price"] is None, "SELL NOW signal must NOT contain an upside Target Price"
    assert signal_dict["potential_return_pct"] is None, "SELL NOW signal must NOT contain a Potential Return"
    assert signal_dict["risk_reward_ratio"] is None

    # VERIFY REASONS CLEANING
    for reason in signal_dict["reasons"]:
        assert "optimal Entry Zone" not in reason
        assert "Suggested profit target" not in reason
        assert "Risk/Reward ratio" not in reason

def test_buy_now_signal_consistency():
    dates = pd.date_range(end=pd.Timestamp.now(), periods=50, freq='D')
    df = pd.DataFrame({
        "Open": [750.0] * 50,
        "High": [755.0] * 50,
        "Low": [740.0] * 50,
        "Close": [745.00] * 50,
        "Volume": [100000] * 50
    }, index=dates)

    support = [
        SRZone(
            upper_bound=740.0, 
            lower_bound=735.0, 
            strength=0.8, 
            touches=3, 
            average_volume=100000.0, 
            first_detection="2026-01-01", 
            last_confirmation="2026-07-20", 
            level_type="support"
        )
    ]
    resistance = [
        SRZone(
            upper_bound=775.0, 
            lower_bound=770.0, 
            strength=0.8, 
            touches=3, 
            average_volume=100000.0, 
            first_detection="2026-01-01", 
            last_confirmation="2026-07-20", 
            level_type="resistance"
        )
    ]

    scores = DummyScores(overall_score=78.0, recommendation="BUY", confidence=88.0)
    risk = DummyRiskProfile(level="Low")
    signal_dict = calculate_trade_signal(df, scores, support, resistance, risk, timeframe="1D")

    assert signal_dict["signal"] == "BUY NOW"
    assert signal_dict["target_price"] > signal_dict["current_price"]
    assert signal_dict["stop_loss_price"] < signal_dict["current_price"]
    assert signal_dict["entry_zone_low"] is not None
    assert signal_dict["entry_zone_high"] is not None

def test_validator_rejects_impossible_combinations():
    # 1. Invalid BUY NOW with target below current price
    invalid_buy = {
        "signal": "BUY NOW",
        "current_price": 100.0,
        "target_price": 95.0, # IMPOSSIBLE TARGET
        "stop_loss_price": 90.0,
        "entry_zone_low": 98.0,
        "entry_zone_high": 102.0
    }
    with pytest.raises(ValueError, match="State Machine Inconsistency"):
        validate_trade_signal_consistency(invalid_buy)

    # 2. Invalid BUY NOW with stop loss above current price
    invalid_stop = {
        "signal": "BUY NOW",
        "current_price": 100.0,
        "target_price": 110.0,
        "stop_loss_price": 105.0, # IMPOSSIBLE STOP LOSS
        "entry_zone_low": 98.0,
        "entry_zone_high": 102.0
    }
    with pytest.raises(ValueError, match="State Machine Inconsistency"):
        validate_trade_signal_consistency(invalid_stop)

def test_timeframe_specific_metrics_scaling():
    dates = pd.date_range(end=pd.Timestamp.now(), periods=50, freq='D')
    df = pd.DataFrame({
        "Open": [750.0] * 50,
        "High": [755.0] * 50,
        "Low": [740.0] * 50,
        "Close": [745.00] * 50,
        "Volume": [100000] * 50
    }, index=dates)

    support = [SRZone(upper_bound=740.0, lower_bound=735.0, strength=0.8, touches=3, average_volume=100000.0, first_detection="2026-01-01", last_confirmation="2026-07-20", level_type="support")]
    resistance = [SRZone(upper_bound=775.0, lower_bound=770.0, strength=0.8, touches=3, average_volume=100000.0, first_detection="2026-01-01", last_confirmation="2026-07-20", level_type="resistance")]
    scores = DummyScores(overall_score=78.0, recommendation="BUY", confidence=88.0)
    risk = DummyRiskProfile(level="Low")

    sig_5m = calculate_trade_signal(df, scores, support, resistance, risk, timeframe="5M")
    sig_10m = calculate_trade_signal(df, scores, support, resistance, risk, timeframe="10M")
    sig_30m = calculate_trade_signal(df, scores, support, resistance, risk, timeframe="30M")
    sig_1d = calculate_trade_signal(df, scores, support, resistance, risk, timeframe="1D")
    sig_1w = calculate_trade_signal(df, scores, support, resistance, risk, timeframe="1W")
    sig_1m = calculate_trade_signal(df, scores, support, resistance, risk, timeframe="1M")

    # Verify intraday to swing timeframe target prices expand
    assert sig_5m["target_price"] < sig_10m["target_price"] < sig_30m["target_price"] < sig_1d["target_price"] < sig_1w["target_price"] < sig_1m["target_price"]
    
    # Verify intraday holding times
    assert sig_5m["holding_time"] in ["5–30 minutes", "5–20 minutes"]
    assert sig_10m["holding_time"] == "15–45 minutes"
    assert sig_30m["holding_time"] in ["30 min–4 hrs", "1–4 hours"]
    assert sig_1d["holding_time"] in ["1–5 days", "1–3 days"]
    assert sig_1w["holding_time"] == "1–3 weeks"
    assert sig_1m["holding_time"] == "1–3 months"

