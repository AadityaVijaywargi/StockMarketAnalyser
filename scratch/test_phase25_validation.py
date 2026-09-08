import sys
import os

# Add project root to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import pandas as pd
from datetime import datetime

from analysis.prediction_engine import DeterministicPredictionEngine
from analysis.models.scores import TechnicalScores, ScoreComponent
from analysis.models.risk import RiskProfile
from intelligence.schemas import IntelligencePack, KeyEvent, OverallSentiment
from analysis.models.prediction import get_recommendation_from_probability


def run_phase_25_validation():
    print("==================================================")
    print("  PHASE 25 LIVE AI TRADING ASSISTANT VALIDATION   ")
    print("==================================================")

    # 1. Verify 7-Level Recommendation Mapping Function
    test_probs = [95.0, 85.0, 68.0, 52.0, 32.0, 18.0, 5.0]
    expected_recs = ["STRONG BUY", "BUY", "ACCUMULATE", "HOLD", "REDUCE", "SELL", "STRONG SELL"]
    
    print("\n[1/5] Verifying 7-Level Recommendation Mapping:")
    for prob, expected in zip(test_probs, expected_recs):
        actual = get_recommendation_from_probability(prob)
        status = "PASS" if actual == expected else f"FAIL (Got {actual})"
        print(f"  Probability {prob:4.1f}%  -->  {actual:<12} [{status}]")
        assert actual == expected, f"Expected {expected} for probability {prob}, got {actual}"

    # Synthetic candle data
    df = pd.DataFrame({
        "Close": [100.0 + i * 0.1 for i in range(250)],
        "Open": [99.5 + i * 0.1 for i in range(250)],
        "High": [101.0 + i * 0.1 for i in range(250)],
        "Low": [99.0 + i * 0.1 for i in range(250)],
        "Volume": [1000000 for _ in range(250)],
        "ATR_14": [2.5 for _ in range(250)]
    })

    risk = RiskProfile(
        level="MODERATE", 
        score=45.0, 
        atr_percentage=2.5, 
        annualized_volatility=20.0, 
        vix_regime="Normal", 
        liquidity_score=80.0, 
        summary="", 
        risk_factors=[], 
        mitigation_advice=[]
    )

    scores_neutral = TechnicalScores(
        trend=ScoreComponent(value=50.0, weight=0.3, contribution=15.0),
        momentum=ScoreComponent(value=50.0, weight=0.2, contribution=10.0),
        volume=ScoreComponent(value=50.0, weight=0.15, contribution=7.5),
        volatility=ScoreComponent(value=50.0, weight=0.1, contribution=5.0),
        pattern=ScoreComponent(value=50.0, weight=0.1, contribution=5.0),
        support=ScoreComponent(value=50.0, weight=0.05, contribution=2.5),
        resistance=ScoreComponent(value=50.0, weight=0.05, contribution=2.5),
        market=ScoreComponent(value=50.0, weight=0.0, contribution=0.0),
        sector=ScoreComponent(value=50.0, weight=0.05, contribution=2.5),
        risk=ScoreComponent(value=50.0, weight=0.0, contribution=0.0),
        overall_score=50.0,
        confidence=70.0,
        recommendation="HOLD"
    )

    engine = DeterministicPredictionEngine()

    # 2. Test Scenario A: Positive High-Impact Earnings Beat
    intel_bullish = IntelligencePack(
        ticker="TCS.NS",
        company_name="Tata Consultancy Services",
        overall_sentiment=OverallSentiment(primary_sentiment="Bullish", score=90.0, confidence=95.0, rationale="Strong earnings beat"),
        key_events=[
            KeyEvent(id="e1", title="Q3 Earnings Beat Estimates by 18%", description="Revenue up 15% YoY", event_type="EARNINGS", impact_level="High", sentiment="Bullish", summary="Q3 results exceeded consensus estimates")
        ]
    )

    pred_bullish = engine.predict("TCS.NS", "1d", df, scores_neutral, risk, {}, intel_bullish)
    print("\n[2/5] Test Scenario A: Bullish Earnings Beat Catalyst")
    print(f"  Ticker:               {pred_bullish.ticker}")
    print(f"  Recommendation:       {pred_bullish.recommendation}")
    print(f"  Probability:          {pred_bullish.probability}%")
    print(f"  Confidence:           {pred_bullish.confidence}%")
    print(f"  Event Override:       {pred_bullish.event_override_applied}")
    print(f"  Expected Move:        +{pred_bullish.expected_move_pct}%")
    print(f"  Target / Stop:        INR {pred_bullish.target_price} / INR {pred_bullish.stop_loss}")
    clean_reasons = [r.encode('ascii', errors='ignore').decode() for r in pred_bullish.reasons]
    print(f"  Reasons:              {clean_reasons}")

    assert pred_bullish.recommendation in ["STRONG BUY", "BUY"], f"Expected STRONG BUY or BUY, got {pred_bullish.recommendation}"
    assert pred_bullish.probability >= 75.0, f"Expected probability >= 75.0%, got {pred_bullish.probability}%"
    assert pred_bullish.event_override_applied == True, "Event override should be applied for High impact catalyst"
    assert any("Q3 Earnings Beat" in r for r in pred_bullish.reasons), "Reason bullet should contain catalyst title"

    # 3. Test Scenario B: Neutral Stock
    intel_neutral = IntelligencePack(
        ticker="TCS.NS",
        company_name="Tata Consultancy Services",
        overall_sentiment=OverallSentiment(primary_sentiment="Neutral", score=50.0, confidence=50.0, rationale="No key events"),
        key_events=[]
    )

    pred_neutral = engine.predict("TCS.NS", "1d", df, scores_neutral, risk, {}, intel_neutral)
    print("\n[3/5] Test Scenario B: Neutral Stock")
    print(f"  Recommendation:       {pred_neutral.recommendation}")
    print(f"  Probability:          {pred_neutral.probability}%")
    print(f"  Confidence:           {pred_neutral.confidence}%")

    assert pred_neutral.recommendation == "HOLD", f"Expected HOLD for neutral stock, got {pred_neutral.recommendation}"

    # 4. Test Scenario C: Bearish Earnings Miss
    intel_bearish = IntelligencePack(
        ticker="TCS.NS",
        company_name="Tata Consultancy Services",
        overall_sentiment=OverallSentiment(primary_sentiment="Bearish", score=10.0, confidence=90.0, rationale="Severe earnings miss"),
        key_events=[
            KeyEvent(id="e2", title="Q3 Earnings Missed Estimates by 20%", description="Margin contraction", event_type="EARNINGS", impact_level="High", sentiment="Bearish", summary="Net profit fell sharply")
        ]
    )

    pred_bearish = engine.predict("TCS.NS", "1d", df, scores_neutral, risk, {}, intel_bearish)
    print("\n[4/5] Test Scenario C: Bearish Earnings Miss Catalyst")
    print(f"  Recommendation:       {pred_bearish.recommendation}")
    print(f"  Probability:          {pred_bearish.probability}%")
    print(f"  Confidence:           {pred_bearish.confidence}%")
    print(f"  Event Override:       {pred_bearish.event_override_applied}")

    assert pred_bearish.recommendation in ["SELL", "STRONG SELL"], f"Expected SELL or STRONG SELL, got {pred_bearish.recommendation}"
    assert pred_bearish.probability <= 30.0, f"Expected probability <= 30.0%, got {pred_bearish.probability}%"

    print("\n[5/5] All Phase 25 Validation Tests Passed Cleanly!")
    print("==================================================")


if __name__ == "__main__":
    run_phase_25_validation()
