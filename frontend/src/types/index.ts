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

export type RecommendationType = 'STRONG BUY' | 'BUY' | 'ACCUMULATE' | 'HOLD' | 'REDUCE' | 'SELL' | 'STRONG SELL';

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
  confidence?: number;
  recommendation: RecommendationType;
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
  moving_averages?: Record<string, number[]>;
  support_lines?: number[];
  resistance_lines?: number[];
  patterns_coordinates?: Array<{
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

export interface SectionWithEvidence {
  text: string;
  evidence: string[];
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
  fallback_reason?: string;
}

export interface AIResearchReport {
  executive_summary: string;
  investment_thesis: SectionWithEvidence | string;
  bull_case: FactorEvidence[];
  bear_case: FactorEvidence[];
  key_risks: FactorEvidence[];
  technical_outlook: SectionWithEvidence | string;
  short_term_outlook: SectionWithEvidence | string;
  medium_term_outlook: SectionWithEvidence | string;
  action_plan: SectionWithEvidence | string;
  disclaimer: string;
  trading_strategy?: TradingStrategy;
  recommendation_explanation?: string;
  bullish_factors?: FactorEvidence[];
  bearish_factors?: FactorEvidence[];
  market_context?: string;
  risk_assessment?: string;
  invalidation_conditions?: string;
  final_verdict?: string;
  metadata?: AIMetadata;
}

// Phase 12 - Market Intelligence Interfaces
export interface NewsArticle {
  id: string;
  headline: string;
  summary: string;
  published_at: string;
  publisher: string;
  url: string;
  entities: string[];
  topic: 'Earnings' | 'Management' | 'Products' | 'Acquisition' | 'Regulation' | 'Litigation' | 'Dividend' | 'Macro' | 'Industry' | 'General';
  sentiment: 'Bullish' | 'Neutral' | 'Bearish';
  sentiment_confidence: number;
  source_credibility?: 'High' | 'Medium-High' | 'Standard';
  is_verified_source?: boolean;
  key_points?: string[];
  publisher_metadata?: Record<string, any>;
  relevance_score: number;
  article_type: 'company' | 'sector' | 'macro';
}

export interface KeyEvent {
  id: string;
  event_type: string;
  title: string;
  description: string;
  impact_level: 'High' | 'Medium' | 'Low';
  sentiment: 'Bullish' | 'Neutral' | 'Bearish';
  date: string;
}

export interface OverallSentiment {
  bullish_pct: number;
  bearish_pct: number;
  neutral_pct: number;
  confidence: number;
  primary_sentiment: 'Bullish' | 'Neutral' | 'Bearish';
}

export interface IntelligencePack {
  ticker: string;
  company_news: NewsArticle[];
  sector_news: NewsArticle[];
  macro_news: NewsArticle[];
  key_events: KeyEvent[];
  overall_sentiment: OverallSentiment;
  fetched_at: string;
}

export interface TradeSignal {
  signal: 'BUY NOW' | 'WAIT' | 'SELL NOW' | 'AVOID';
  signal_type: 'BUY_NOW' | 'WAIT' | 'SELL_NOW' | 'AVOID';
  current_price: number;
  entry_zone_low?: number;
  entry_zone_high?: number;
  target_price?: number;
  stop_loss_price?: number;
  potential_return_pct?: number;
  expected_move_low_pct?: number;
  expected_move_high_pct?: number;
  expected_price_range_low?: number;
  expected_price_range_high?: number;
  risk_pct?: number;
  risk_reward_ratio?: number;
  risk_level: 'Low' | 'Medium' | 'High' | 'Very High';
  confidence: number;
  holding_time: string;
  timeframe: string;
  reasons: string[];
  lifecycle_status: 'ENTRY_VALID' | 'TRADE_ACTIVE' | 'TARGET_REACHED' | 'MISSED_ENTRY' | 'EXIT_SUGGESTED' | 'TRADE_CLOSED';
  status_note?: string;
  reentry_zone_low?: number;
  reentry_zone_high?: number;
  reentry_target_price?: number;
  reentry_stop_loss?: number;
  reentry_return_pct?: number;
  expected_volatility?: string;
  strategy_label?: string;
  primary_indicators?: string[];
  position_status?: 'NO_POSITION' | 'HOLDING_LONG' | 'HOLDING_SHORT';
  position_action?: 'BUY NOW' | 'WAIT' | 'AVOID' | 'SELL NOW' | 'HOLD' | 'PARTIAL SELL';
  trailing_stop_price?: number;
  next_resistance_target?: number;
  profit_protection_level?: number;
  remaining_upside_pct?: number;
  downside_risk_pct?: number;
  rally_probability?: number;
}

export type ChartStyle = 'candlestick' | 'bar' | 'area' | 'line' | 'baseline' | 'heikin_ashi';

export type DrawingToolType = 'cursor' | 'trendline' | 'horizontal' | 'vertical' | 'fibonacci';

export interface DrawingObject {
  id: string;
  type: DrawingToolType;
  ticker: string;
  points: { time: any; price: number }[];
  color: string;
  lineWidth?: number;
  text?: string;
}

export interface ChartEventMarker {
  time: any;
  position: 'aboveBar' | 'belowBar' | 'inBar';
  color: string;
  shape: 'circle' | 'square' | 'arrowUp' | 'arrowDown';
  text: string;
  description?: string;
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
  trade_signal?: TradeSignal;
  ai_research_report?: AIResearchReport;
  intelligence_pack?: IntelligencePack;
  prediction?: PredictionResult;
  recommendation?: RecommendationType;
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

export type PredictionTrend = 'Improving' | 'Stable' | 'Weakening';

export interface RecommendationHistoryEntry {
  timestamp: string;
  recommendation: RecommendationType;
  confidence: number;
  probability: number;
  reason?: string;
}

export interface MonitorHealthMetrics {
  status: 'IDLE' | 'RUNNING' | 'STOPPED';
  monitored_count: number;
  avg_refresh_time_ms: number;
  cache_hit_rate: number;
  failed_count: number;
  last_refresh: string;
}

export type PredictionHorizon = '5m' | '10m' | '15m' | '30m' | '1d' | '1w' | '1mo';

export interface PredictionResult {
  ticker: string;
  horizon: PredictionHorizon;
  direction: 'UP' | 'DOWN' | 'NEUTRAL';
  recommendation: RecommendationType;
  probability: number;
  confidence: number;
  expected_move_pct: number;
  target_price: number;
  stop_loss: number;
  risk: string;
  reasons: string[];
  signal_scores: Record<string, number>;
  event_override_applied: boolean;
  last_updated?: string;
  prediction_trend?: PredictionTrend;
  history?: RecommendationHistoryEntry[];
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

export interface WatchlistItem {
  id: string;
  ticker: string;
  company_name: string;
  exchange: string;
  date_added: string;
  pinned?: boolean;
  notes?: string;
  tags?: string[];
  alert_settings?: Record<string, any>;
  price_target?: number;
  portfolio_quantity?: number;
  average_buy_price?: number;
}

export type NotificationSeverity = 'INFO' | 'WARNING' | 'IMPORTANT';

export type NotificationPriority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export type NotificationCategory = 'RECOMMENDATIONS' | 'NEWS' | 'PRICE_ALERTS' | 'PORTFOLIO' | 'MARKET' | 'SYSTEM' | 'AI_INSIGHTS';

export type NotificationType = 
  | 'RECOMMENDATION_CHANGE' 
  | 'PRICE_ALERT' 
  | 'NEWS_ALERT' 
  | 'AI_ALERT' 
  | 'PORTFOLIO_ALERT' 
  | 'DIVIDEND' 
  | 'EARNINGS' 
  | 'VOLUME_SPIKE';

export interface NotificationTimelineEntry {
  timestamp: string;
  recommendation: string;
  confidence: number;
  reason?: string;
}

export interface AppNotification {
  id: string;
  ticker: string;
  company_name: string;
  type: NotificationType;
  category?: NotificationCategory;
  priority: NotificationPriority;
  severity: NotificationSeverity;
  old_recommendation: string;
  new_recommendation: string;
  old_confidence: number;
  new_confidence: number;
  change_reason: string[];
  expected_move_pct?: number;
  target_price?: number;
  stop_loss?: number;
  timestamp: string;
  read?: boolean;
  timeline?: NotificationTimelineEntry[];
}

export type TradeStatus = 
  | 'ACTIVE' 
  | 'TARGET_REACHED' 
  | 'STOP_LOSS_REACHED' 
  | 'TRAILING_STOP_REACHED' 
  | 'MANUAL_EXIT' 
  | 'TARGET_NEAR'
  | 'EXIT_SUGGESTED'
  | 'STOP_LOSS_HIT'
  | 'CLOSED';

export interface TrackedTrade {
  id: string;
  ticker: string;
  company_name: string;
  tracker_type?: 'BUY' | 'SELL';
  quantity: number;
  avg_buy_price?: number;
  entry_price: number;
  current_price: number;
  investment_value: number; // entry_price * quantity
  entry_time: string;
  timeframe: string;
  target_price: number;
  initial_stop_loss: number;
  trailing_stop_loss: number;

  // Phase 30 Config Flags & Notes
  enable_trailing_stop: boolean;
  enable_auto_exit_target: boolean;
  enable_auto_exit_stop: boolean;
  trade_notes?: string;

  // Phase 30 Calculated Metrics
  risk_reward_ratio: number; // (target - entry) / (entry - stop)
  expected_profit: number; // (target - entry) * quantity
  max_loss: number; // (entry - stop) * quantity

  // Live Metrics
  profit_pct: number;
  profit_amount: number;
  distance_to_target_pct: number;
  distance_to_stop_pct: number;
  highest_profit_pct: number;
  max_drawdown_pct: number;
  target_progress_pct: number;
  holding_time_mins: number;

  // AI Intelligence at Entry & Exit
  initial_confidence: number;
  initial_signal: string;
  ai_confidence_at_entry?: number;
  ai_recommendation_at_entry?: string;
  ai_confidence_at_exit?: number;
  ai_recommendation_at_exit?: string;

  status: TradeStatus;
  exit_recommendation: 'HOLD' | 'EXIT NOW' | 'TAKE PROFIT' | 'STOP LOSS HIT' | 'PARTIAL SELL';
  exit_price?: number;
  exit_time?: string;
  exit_reason?: string;
  exit_signal?: string;
}

export interface BacktestTrade {
  entry_date: string;
  exit_date: string;
  entry_price: number;
  exit_price: number;
  pnl_pct: number;
  exit_reason: string;
}

export interface BacktestMetrics {
  final_value: number;
  total_return_pct: number;
  cagr_pct: number;
  max_drawdown_pct: number;
  sharpe_ratio: number;
  total_trades: number;
  win_rate_pct: number;
  avg_win_pct: number;
  avg_loss_pct: number;
}

export interface BacktestResult {
  ticker: string;
  period: string;
  bars_simulated: number;
  strategy_name: string;
  initial_capital: number;
  equity_curve: { date: string; value: number }[];
  trades: BacktestTrade[];
  open_position: { entry_date: string; entry_price: number; unrealized_pnl_pct: number } | null;
  metrics: BacktestMetrics;
}

export interface TradePerformanceSummary {
  total_trades: number;
  active_trades: number;
  closed_trades: number;
  winning_trades: number;
  losing_trades: number;
  win_rate_pct: number;
  average_gain_pct: number;
  average_loss_pct: number;
  risk_reward_ratio: number;
  ai_accuracy_pct: number;
  largest_win_pct: number;
  largest_loss_pct: number;
  total_realized_pnl: number;
  average_holding_time: string;
}
