export interface IndexTrend {
  symbol: string;
  direction: 'BULLISH' | 'BEARISH' | 'SIDEWAYS';
  strength: number;
  momentum: number;
}

export interface VolatilityContext {
  vix_value: number;
  percentile: number;
  regime: 'Low' | 'Normal' | 'Elevated' | 'Extreme';
}

export interface SectorAnalysis {
  sector_name: string;
  sector_symbol: string;
  direction: 'BULLISH' | 'BEARISH' | 'SIDEWAYS';
  strength: number;
  relative_strength_vs_nifty: number;
  sector_momentum: number;
}

export interface MarketContext {
  nifty: IndexTrend;
  bank_nifty: IndexTrend;
  vix: VolatilityContext;
  sector: SectorAnalysis;
  stock_beta: number;
  stock_correlation: number;
  relative_strength_rating: number;
  relative_strength_line: number[];
}

export interface ScoreComponent {
  value: number;
  weight: number;
  contribution: number;
}

export interface TechnicalScores {
  trend: ScoreComponent;
  momentum: ScoreComponent;
  volume: ScoreComponent;
  volatility: ScoreComponent;
  pattern: ScoreComponent;
  support: ScoreComponent;
  resistance: ScoreComponent;
  market: ScoreComponent;
  sector: ScoreComponent;
  risk: ScoreComponent;
  overall_score: number;
  recommendation: 'BUY' | 'WATCH' | 'AVOID';
}

export interface RiskProfile {
  level: 'Low' | 'Moderate' | 'High' | 'Very High';
  atr_percentage: number;
  annualized_volatility: number;
  vix_regime: 'Low' | 'Normal' | 'Elevated' | 'Extreme';
  liquidity_score: number;
}

export interface ChartData {
  dates: string[];
  open: number[];
  high: number[];
  low: number[];
  close: number[];
  volume: number[];
  moving_averages: Record<string, number[]>;
  support_lines: number[];
  resistance_lines: number[];
  patterns_coordinates: Array<{
    pattern_name: string;
    start_date: string;
    end_date: string;
    direction: string;
    status: string;
    key_levels: number[];
    label: string;
  }>;
}

export interface PatternDetection {
  pattern_name: string;
  start_date: string;
  end_date: string;
  confidence_score: number;
  supporting_evidence: Record<string, any>;
  key_price_levels: number[];
  pattern_direction: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  pattern_status: 'Forming' | 'Confirmed' | 'Invalidated';
}

export interface SRZone {
  upper_bound: number;
  lower_bound: number;
  strength: number;
  touches: number;
  average_volume: number;
  first_detection: string;
  last_confirmation: string;
  level_type: 'support' | 'resistance';
}

export interface FactorEvidence {
  title: string;
  explanation: string;
  evidence: string[];
}

export interface TradingStrategy {
  entry: string;
  stop_loss: string;
  target_1: string;
  target_2: string;
  expected_holding_period: string;
}

export interface AIMetadata {
  model: string;
  prompt_version: string;
  generated_at: string;
  cached: boolean;
  response_time_ms: number;
  token_usage?: {
    input_tokens: number;
    output_tokens: number;
  };
}

export interface AIResearchReport {
  executive_summary: string;
  investment_thesis: string;
  recommendation_explanation: string;
  bullish_factors: FactorEvidence[];
  bearish_factors: FactorEvidence[];
  technical_outlook: string;
  market_context: string;
  risk_assessment: string;
  trading_strategy: TradingStrategy;
  invalidation_conditions: string;
  final_verdict: string;
  metadata?: AIMetadata;
}

export interface DeterministicAnalysisReport {
  ticker: string;
  company_name: string;
  analysis_date: string;
  market_context: MarketContext;
  scores: TechnicalScores;
  risk_profile: RiskProfile;
  positive_factors: string[];
  negative_factors: string[];
  neutral_factors: string[];
  chart_data: ChartData;
  patterns: PatternDetection[];
  support_zones: SRZone[];
  resistance_zones: SRZone[];
  ai_research_report?: AIResearchReport;
  metadata?: {
    timings: Record<string, number>;
  };
}

export interface LiveQuote {
  ticker: string;
  price: number;
  change: number;
  change_pct: number;
  high: number;
  low: number;
  volume: number;
  last_updated: string;
  is_market_open: boolean;
}

export interface TopOpportunityCard {
  ticker: string;
  company_name: string;
  current_price: number;
  price_change_pct: number;
  overall_score: number;
  recommendation: 'BUY' | 'WATCH' | 'AVOID';
  confidence: number;
  trend_direction: 'BULLISH' | 'BEARISH';
  sector: string;
  top_bullish_factors: string[];
  top_bearish_factors: string[];
  key_highlights: string[];
}

export interface TopOpportunitiesResponse {
  updated_at: string;
  total_scanned: number;
  opportunities: TopOpportunityCard[];
}
