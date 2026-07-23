from pydantic import BaseModel, Field, field_validator
from typing import Any
import numpy as np

class ScoreComponent(BaseModel):
    """
    Represents an individual score element containing value, weight, and contribution.
    """
    value: float = Field(..., ge=0.0, le=100.0)
    weight: float = Field(..., ge=0.0, le=1.0)
    contribution: float = Field(..., ge=0.0, le=100.0)

    @field_validator("value", "weight", "contribution", mode="before")
    @classmethod
    def sanitize_values(cls, v: Any) -> float:
        """Centralized validator to handle NaN/inf for score component fields."""
        try:
            if v is None:
                return 0.0
            val = float(v)
            if np.isnan(val) or np.isinf(val):
                return 0.0
            return val
        except Exception:
            return 0.0


class TechnicalScores(BaseModel):
    """
    Consolidated Pydantic model for all scoring engine components.
    """
    trend: ScoreComponent
    momentum: ScoreComponent
    volume: ScoreComponent
    volatility: ScoreComponent
    pattern: ScoreComponent
    support: ScoreComponent
    resistance: ScoreComponent
    market: ScoreComponent
    sector: ScoreComponent
    risk: ScoreComponent
    overall_score: float = Field(..., ge=0.0, le=100.0)
    confidence: float = Field(default=50.0, ge=0.0, le=100.0, description="Calculated engine confidence score (0-100)")
    recommendation: str = Field(..., description="BUY, WATCH, or AVOID")

    @field_validator("overall_score", mode="before")
    @classmethod
    def sanitize_overall(cls, v: Any) -> float:
        """Sanitizes overall score to be finite."""
        try:
            if v is None:
                return 0.0
            val = float(v)
            if np.isnan(val) or np.isinf(val):
                return 0.0
            return min(max(val, 0.0), 100.0)
        except Exception:
            return 0.0
