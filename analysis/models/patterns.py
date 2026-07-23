from pydantic import BaseModel, Field, field_validator
from typing import Dict, Any, List
import numpy as np

class PatternDetection(BaseModel):
    """
    Model representing a detected chart pattern with supporting metadata and evidence.
    """
    pattern_name: str = Field(..., description="Name of the chart pattern")
    start_date: str = Field(..., description="Start date of pattern formation (YYYY-MM-DD)")
    end_date: str = Field(..., description="End date of pattern or breakout (YYYY-MM-DD)")
    confidence_score: float = Field(..., ge=0.0, le=1.0, description="Confidence score from 0.0 to 1.0")
    supporting_evidence: Dict[str, Any] = Field(
        default_factory=dict, 
        description="Quantitative evidence (e.g. pivot count, breakout volume ratio, slope)"
    )
    key_price_levels: List[float] = Field(
        default_factory=list, 
        description="Key levels associated with the pattern (e.g. neckline, peaks)"
    )
    pattern_direction: str = Field(..., description="BULLISH, BEARISH, or NEUTRAL")
    pattern_status: str = Field(..., description="Forming, Confirmed, or Invalidated")

    @field_validator("confidence_score", mode="before")
    @classmethod
    def validate_confidence(cls, v: Any) -> float:
        """Centralized validator to handle NaN, inf, and validation constraints for confidence score."""
        if v is None:
            return 0.5
        try:
            val = float(v)
        except Exception:
            return 0.5
            
        if np.isnan(val) or np.isinf(val):
            return 0.5
            
        if val < 0.0 or val > 1.0:
            raise ValueError("confidence_score must be between 0.0 and 1.0")
            
        return round(val, 2)
