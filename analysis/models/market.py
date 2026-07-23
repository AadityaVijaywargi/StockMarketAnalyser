from pydantic import BaseModel, Field, field_validator
from typing import List, Dict, Any, Optional
import numpy as np

class IndexTrendModel(BaseModel):
    """
    Direction and strength of a market benchmark index.
    """
    symbol: str
    direction: str = Field(..., description="BULLISH, BEARISH, or SIDEWAYS")
    strength: float = Field(..., ge=0.0, le=100.0)
    momentum: float = Field(..., description="RSI or ROC score of the index")

    @field_validator("strength", "momentum", mode="before")
    @classmethod
    def sanitize_index_metrics(cls, v: Any) -> float:
        try:
            if v is None:
                return 50.0
            val = float(v)
            if np.isnan(val) or np.isinf(val):
                return 50.0
            return min(max(val, 0.0), 100.0)
        except Exception:
            return 50.0


class VolatilityContextModel(BaseModel):
    """
    Volatility analysis using India VIX.
    """
    vix_value: float
    percentile: float = Field(..., description="VIX historical percentile")
    regime: str = Field(..., description="Low, Normal, Elevated, or Extreme")

    @field_validator("vix_value", "percentile", mode="before")
    @classmethod
    def sanitize_vix_metrics(cls, v: Any) -> float:
        try:
            if v is None:
                return 15.0
            val = float(v)
            if np.isnan(val) or np.isinf(val):
                return 15.0
            return val
        except Exception:
            return 15.0


class SectorAnalysisModel(BaseModel):
    """
    Relative performance and trends of the stock's sector.
    """
    sector_name: str
    sector_symbol: str
    direction: str = Field(..., description="BULLISH, BEARISH, or SIDEWAYS")
    strength: float
    relative_strength_vs_nifty: float = Field(..., description="Relative strength ratio vs Nifty")
    sector_momentum: float

    @field_validator("strength", "relative_strength_vs_nifty", "sector_momentum", mode="before")
    @classmethod
    def sanitize_sector_metrics(cls, v: Any) -> float:
        try:
            if v is None:
                return 1.0
            val = float(v)
            if np.isnan(val) or np.isinf(val):
                return 1.0
            return val
        except Exception:
            return 1.0


class MarketContextModel(BaseModel):
    """
    Complete Market Context output containing general market indexes, VIX, and sector analysis.
    """
    nifty: IndexTrendModel
    bank_nifty: IndexTrendModel
    vix: VolatilityContextModel
    sector: SectorAnalysisModel
    stock_beta: float = Field(..., description="Stock beta relative to Nifty 50")
    stock_correlation: float = Field(..., description="Correlation coefficient with Nifty 50")
    relative_strength_rating: float = Field(..., description="Relative strength percentile rating (0-100)")
    relative_strength_line: List[float] = Field(default_factory=list, description="Historical relative strength ratio series")

    @field_validator("stock_beta", "stock_correlation", "relative_strength_rating", mode="before")
    @classmethod
    def sanitize_market_metrics(cls, v: Any) -> float:
        try:
            if v is None:
                return 1.0
            val = float(v)
            if np.isnan(val) or np.isinf(val):
                return 1.0
            return val
        except Exception:
            return 1.0


class TopOpportunityCard(BaseModel):
    """
    Structured card model representing a top-ranked stock opportunity.
    """
    ticker: str
    company_name: str
    current_price: float
    price_change_pct: float
    overall_score: float
    recommendation: str
    confidence: float
    trend_direction: str
    sector: str
    top_bullish_factors: List[str] = Field(default_factory=list)
    top_bearish_factors: List[str] = Field(default_factory=list)
    key_highlights: List[str] = Field(default_factory=list)


class TopOpportunitiesResponse(BaseModel):
    """
    API payload containing top market opportunities scanned across liquid NSE stocks.
    """
    updated_at: str
    total_scanned: int
    opportunities: List[TopOpportunityCard]

