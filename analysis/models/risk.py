from pydantic import BaseModel, Field

class RiskProfile(BaseModel):
    """
    Risk profile computed from stock volatility, VIX, ATR, and liquidity.
    """
    level: str = Field(..., description="Low, Moderate, High, or Very High")
    atr_percentage: float = Field(..., description="ATR relative to close price (%)")
    annualized_volatility: float = Field(..., description="Historical annualized volatility (%)")
    vix_regime: str = Field(..., description="VIX regime (Low, Normal, Elevated, Extreme)")
    liquidity_score: float = Field(..., description="Normalized liquidity score (0-100)")
