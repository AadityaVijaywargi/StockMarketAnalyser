from pydantic import BaseModel, Field
from typing import List
from analysis.models.patterns import PatternDetection

class TimeframeSummary(BaseModel):
    """
    Deterministic analysis summary for a specific time window (e.g. 1M, 3M, 6M).
    """
    timeframe: str
    trend: str = Field(..., description="BULLISH, BEARISH, or SIDEWAYS")
    trend_strength: float = Field(..., ge=0.0, le=100.0, description="Strength of trend (0-100)")
    momentum: str = Field(..., description="BULLISH, BEARISH, or NEUTRAL")
    volatility: float = Field(..., description="Average True Range (ATR) or annualized standard deviation")
    support_levels: List[float] = Field(default_factory=list)
    resistance_levels: List[float] = Field(default_factory=list)
    patterns: List[PatternDetection] = Field(default_factory=list)
