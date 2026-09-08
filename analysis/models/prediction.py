from typing import Dict, List, Optional
from pydantic import BaseModel, Field
from config.weights import RECOMMENDATION_PROBABILITY_THRESHOLDS


def get_recommendation_from_probability(prob: float) -> str:
    """
    Unified 7-level probability-driven recommendation mapping:
    90–100% → STRONG BUY
    75–89%  → BUY
    60–74%  → ACCUMULATE
    40–59%  → HOLD
    25–39%  → REDUCE
    10–24%  → SELL
    0–9%    → STRONG SELL
    """
    for rec, threshold in RECOMMENDATION_PROBABILITY_THRESHOLDS.items():
        if prob >= threshold:
            return rec
    return "STRONG SELL"


class PredictionResult(BaseModel):
    ticker: str
    horizon: str
    direction: str = Field(description="UP, DOWN, or NEUTRAL")
    recommendation: str = Field(description="STRONG BUY, BUY, ACCUMULATE, HOLD, REDUCE, SELL, or STRONG SELL")
    probability: float = Field(ge=0.0, le=100.0)
    confidence: float = Field(ge=0.0, le=100.0)
    expected_move_pct: float
    target_price: float
    stop_loss: float
    risk: str
    reasons: List[str]
    signal_scores: Dict[str, float]
    event_override_applied: bool = False
    last_updated: Optional[str] = None
