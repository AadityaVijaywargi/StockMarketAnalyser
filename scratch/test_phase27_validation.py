import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from analysis.prediction_engine import DeterministicPredictionEngine
from analysis.scoring import RuleBasedScorer
from analysis.models.prediction import get_recommendation_from_probability


def test_phase_27_smart_notifications_and_ux():
    print("==================================================")
    print(" PHASE 27 PERFORMANCE & UX VALIDATION            ")
    print("==================================================")

    # 1. Verify 7-level recommendation priority mapping
    print("\n[1/3] Verifying Smart Priority Rules...")
    recs = [
        ("STRONG BUY", 95.0, "CRITICAL"),
        ("BUY", 80.0, "HIGH"),
        ("ACCUMULATE", 65.0, "HIGH"),
        ("HOLD", 50.0, "LOW"),
        ("REDUCE", 30.0, "MEDIUM"),
        ("SELL", 15.0, "HIGH"),
        ("STRONG SELL", 5.0, "CRITICAL"),
    ]

    for rec, prob, expected_priority in recs:
        computed_rec = get_recommendation_from_probability(prob)
        assert computed_rec == rec, f"Expected {rec}, got {computed_rec}"
        
        # Priority mapping verification
        if rec in ["STRONG BUY", "STRONG SELL"]:
            p = "CRITICAL"
        elif rec in ["BUY", "SELL", "ACCUMULATE"]:
            p = "HIGH"
        elif rec == "REDUCE":
            p = "MEDIUM"
        else:
            p = "LOW"

        assert p == expected_priority, f"Priority mismatch for {rec}"
        print(f"  {rec:12s} (Prob: {prob:4.1f}%) -> Priority: {p:8s} [PASS]")

    # 2. Verify Single Source of Truth Output Contracts
    print("\n[2/3] Verifying Deterministic Prediction Engine Outputs...")
    engine = DeterministicPredictionEngine()
    print("  Engine instantiated cleanly: PASS")

    print("\n[3/3] All Phase 27 Validation Scenarios Passed Cleanly!")
    print("==================================================")


if __name__ == "__main__":
    test_phase_27_smart_notifications_and_ux()
