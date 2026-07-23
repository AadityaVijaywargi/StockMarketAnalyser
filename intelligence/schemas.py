from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional

class EvidencePack(BaseModel):
    """
    Normalized intermediate evidence object mapping deterministic analysis values.
    Serves as the boundary of grounding data supplied to the Prompt Builder.
    """
    ticker: str
    company_name: str
    price: float
    recommendation: str
    confidence: float
    technical_score: float
    market_regime: str
    signal_agreement: Dict[str, Any]
    category_scores: Dict[str, float]
    positive_contributors: List[str]
    negative_contributors: List[str]
    neutral_factors: List[str]
    support_levels: List[float]
    resistance_levels: List[float]
    detected_patterns: List[str]
    risk_factors: List[str]
    trend_summary: str
    market_context: Dict[str, Any]
    strategy: Dict[str, Any]


class FactorEvidenceModel(BaseModel):
    """Traceability mapping of a bullish or bearish factor back to deterministic evidence."""
    title: str = Field(description="Brief title of the factor catalyst")
    explanation: str = Field(description="Detailed institutional analysis and explanation of the catalyst")
    evidence: List[str] = Field(description="List of raw source variables referenced (e.g. ['trend_score', 'rsi', 'golden_cross'])")


class TradingStrategyModel(BaseModel):
    entry: str = Field(description="Calculated Entry price level and condition")
    stop_loss: str = Field(description="Calculated Stop loss price level and criteria")
    target_1: str = Field(description="First price target level")
    target_2: str = Field(description="Second price target level")
    expected_holding_period: str = Field(description="Recommended duration of hold")


class AIMetadataModel(BaseModel):
    model: str = Field(default="", description="The name of the Gemini model used")
    prompt_version: str = Field(default="", description="The version of the prompt structure used")
    generated_at: str = Field(default="", description="Timestamp when report was generated")
    cached: bool = Field(default=False, description="True if retrieved from response cache")
    response_time_ms: float = Field(default=0.0, description="API response time in milliseconds")
    token_usage: Optional[Dict[str, int]] = Field(default=None, description="Optional metadata containing input/output tokens count")


class AIResearchReportModel(BaseModel):
    """
    Structured response model returned by the Gemini client.
    Enforces strict typing and JSON output conformances.
    """
    executive_summary: str = Field(description="Analyst executive summary of the stock's profile")
    investment_thesis: str = Field(description="The primary core investment rationale in 2-3 professional paragraphs")
    recommendation_explanation: str = Field(description="Clear reasoning behind the specific recommendation issued")
    bullish_factors: List[FactorEvidenceModel] = Field(description="At least 5 detailed bullish catalysts with source evidence")
    bearish_factors: List[FactorEvidenceModel] = Field(description="At least 5 detailed bearish risk catalysts with source evidence")
    technical_outlook: str = Field(description="Interpretation of moving averages, oscillators, and patterns")
    market_context: str = Field(description="Impact of broad indices (Nifty, VIX) and sector performance")
    risk_assessment: str = Field(description="Portfolio risk analysis including systematic beta, correlation, and downside levels")
    trading_strategy: TradingStrategyModel = Field(description="Entry levels, stops, targets, and expected hold times")
    invalidation_conditions: str = Field(description="Trigger conditions that would invalidate this investment thesis")
    final_verdict: str = Field(description="Concluding verdict BUY/WATCH/AVOID justification summary")
    metadata: Optional[AIMetadataModel] = Field(default=None, description="Internal trace metadata")
