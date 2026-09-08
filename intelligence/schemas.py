from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional, Union

class NewsArticle(BaseModel):
    """
    Extracted and normalized market/company news article model.
    """
    id: str = Field(description="Unique article identifier or hash")
    headline: str = Field(description="Headline or title of the article")
    summary: str = Field(description="Summary or excerpt of the article content")
    published_at: str = Field(description="Publication timestamp (ISO format or formatted string)")
    publisher: str = Field(description="Source publisher or news agency (e.g. Economic Times, Moneycontrol, Reuters)")
    url: str = Field(default="", description="Canonical URL to source article")
    entities: List[str] = Field(default_factory=list, description="Extracted ticker/company/sector entity tags")
    topic: str = Field(default="General", description="Topic classification (Earnings, Management, Products, Acquisition, Regulation, Litigation, Dividend, Macro, Industry, General)")
    sentiment: str = Field(default="Neutral", description="Contextual sentiment (Bullish, Neutral, Bearish)")
    source_credibility: Optional[str] = Field(default="Standard", description="Credibility tier (High, Medium-High, Standard)")
    publisher_metadata: Optional[Dict[str, Any]] = Field(default=None, description="Structured publisher metadata (name, credibility_score, publisher_type, country)")
    relevance_score: float = Field(default=80.0, description="Calculated relevance score to target stock (0-100)")
    article_type: str = Field(default="company", description="Scope of news article (company, sector, macro)")


class KeyEvent(BaseModel):
    """
    Detected corporate action or macro market event.
    """
    id: str = Field(description="Unique event identifier")
    event_type: str = Field(description="Category (Quarterly earnings, Guidance revisions, Dividend announcements, Stock splits, Bonus issues, Acquisitions, Management changes, Government policy, Large contracts)")
    title: str = Field(description="Short descriptive event title")
    description: str = Field(description="Detailed narrative explanation of the corporate event")
    impact_level: str = Field(default="Medium", description="Estimated price impact level (High, Medium, Low)")
    sentiment: str = Field(default="Neutral", description="Event sentiment orientation (Bullish, Neutral, Bearish)")
    date: str = Field(default="", description="Event announcement or effective date")


class OverallSentiment(BaseModel):
    """
    Aggregated market sentiment breakdown from all active news articles and events.
    """
    bullish_pct: float = Field(default=33.3, description="Percentage of bullish articles/events")
    bearish_pct: float = Field(default=33.3, description="Percentage of bearish articles/events")
    neutral_pct: float = Field(default=33.4, description="Percentage of neutral articles/events")
    confidence: float = Field(default=75.0, description="Overall sentiment confidence percentage")
    primary_sentiment: str = Field(default="Neutral", description="Dominant market sentiment orientation (Bullish, Neutral, Bearish)")


class IntelligencePack(BaseModel):
    """
    Complete Market Intelligence Pack aggregating external news, corporate events, macro trends, and sentiment metrics.
    """
    ticker: str = Field(description="Target stock symbol")
    company_news: List[NewsArticle] = Field(default_factory=list, description="Recent direct company news articles")
    sector_news: List[NewsArticle] = Field(default_factory=list, description="Broader sector & industry news articles")
    macro_news: List[NewsArticle] = Field(default_factory=list, description="Macroeconomic & regulatory news articles")
    key_events: List[KeyEvent] = Field(default_factory=list, description="Detected corporate actions and key events")
    overall_sentiment: OverallSentiment = Field(default_factory=OverallSentiment, description="Aggregated market sentiment summary")
    fetched_at: str = Field(default="", description="Timestamp when intelligence pack was compiled")


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
    timeframe: str = "1d"
    latest_candle_timestamp: str = ""
    intelligence_pack: Optional[IntelligencePack] = None


class SectionWithEvidence(BaseModel):
    """Container for narrative section text with evidence attribution tags."""
    text: str = Field(description="Detailed narrative text explaining this section")
    evidence: List[str] = Field(default_factory=list, description="Traceable evidence tags from the deterministic quantitative engine")


class FactorEvidenceModel(BaseModel):
    """Traceability mapping of a bullish, bearish, or risk factor back to deterministic evidence."""
    title: str = Field(description="Brief title of the factor catalyst")
    explanation: str = Field(description="Detailed institutional analysis and explanation of the catalyst")
    evidence: List[str] = Field(default_factory=list, description="List of raw source variables referenced (e.g. ['trend_score', 'rsi_14', 'support_levels'])")


class TradingStrategyModel(BaseModel):
    entry: str = Field(description="Calculated Entry price level and condition")
    stop_loss: str = Field(description="Calculated Stop loss price level and criteria")
    target_1: str = Field(description="First price target level")
    target_2: str = Field(description="Second price target level")
    expected_holding_period: str = Field(description="Recommended duration of hold")


class AIMetadataModel(BaseModel):
    model: str = Field(default="", description="The name of the LLM provider and model used")
    prompt_version: str = Field(default="", description="The version of the prompt structure used")
    generated_at: str = Field(default="", description="Timestamp when report was generated")
    cached: bool = Field(default=False, description="True if retrieved from response cache")
    response_time_ms: float = Field(default=0.0, description="API response time in milliseconds")
    token_usage: Optional[Dict[str, int]] = Field(default=None, description="Optional token usage metrics")
    fallback_reason: Optional[str] = Field(default=None, description="Reason if fallback was used")


class AIResearchReportModel(BaseModel):
    """
    Structured response model returned by the LLM providers.
    Enforces strict typing, evidence attribution, and JSON output conformances.
    """
    executive_summary: str = Field(description="Analyst executive summary of the stock's profile")
    investment_thesis: SectionWithEvidence = Field(description="Primary core investment rationale with evidence attribution")
    bull_case: List[FactorEvidenceModel] = Field(description="Bullish catalysts with evidence attribution")
    bear_case: List[FactorEvidenceModel] = Field(description="Bearish risk catalysts with evidence attribution")
    key_risks: List[FactorEvidenceModel] = Field(description="Key structural or market risk catalysts with evidence attribution")
    technical_outlook: SectionWithEvidence = Field(description="Technical indicator interpretation with evidence attribution")
    short_term_outlook: SectionWithEvidence = Field(description="Tactical short-term (1-5 days) outlook with evidence attribution")
    medium_term_outlook: SectionWithEvidence = Field(description="Strategic medium-term (1-3 months) outlook with evidence attribution")
    action_plan: SectionWithEvidence = Field(description="Specific actionable execution parameters with evidence attribution")
    disclaimer: str = Field(description="Standard institutional equity research disclaimer")
    trading_strategy: Optional[TradingStrategyModel] = Field(default=None, description="Entry, stop loss, and price targets")
    recommendation_explanation: Optional[str] = Field(default="", description="Explanation of deterministic recommendation")
    final_verdict: Optional[str] = Field(default="", description="Concluding verdict summary")
    metadata: Optional[AIMetadataModel] = Field(default=None, description="Internal trace metadata")
