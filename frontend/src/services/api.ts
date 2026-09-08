import axios from 'axios';
import { DeterministicAnalysisReport, LiveQuote, PredictionHorizon, PredictionResult, TopOpportunitiesResponse, TradeSignal, BacktestResult } from '../types';

export type RecommendationRefresh = Pick<
  DeterministicAnalysisReport,
  'scores' | 'risk_profile' | 'positive_factors' | 'negative_factors' | 'neutral_factors'
>;

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8002';

const client = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const apiService = {
  /**
   * Fetch service health status
   */
  async getHealth() {
    const response = await client.get('/health');
    return response.data;
  },

  /**
   * Runs complete quantitative analysis on a single stock ticker.
   */
  async analyzeTicker(ticker: string, timeframe: string = '1d', signal?: AbortSignal, debug: boolean = true, forceRefresh: boolean = false): Promise<DeterministicAnalysisReport> {
    const response = await client.get<DeterministicAnalysisReport>(`/analyze/${ticker}`, {
      params: { timeframe, debug, force_refresh: forceRefresh },
      signal,
    });
    return response.data;
  },

  /**
   * Fetches lightweight real-time price quotes.
   */
  async getLiveQuote(ticker: string): Promise<LiveQuote> {
    const response = await client.get<LiveQuote>(`/analyze/${ticker}/quote`);
    return response.data;
  },

  /**
   * Recalculates score outputs from the latest live quote without rebuilding the full report.
   */
  async refreshRecommendation(ticker: string): Promise<RecommendationRefresh> {
    const response = await client.get<RecommendationRefresh>(`/analyze/${ticker}/recommendation`);
    return response.data;
  },

  async getPrediction(ticker: string, horizon: PredictionHorizon): Promise<PredictionResult> {
    const response = await client.get<PredictionResult>(`/analyze/${ticker}/prediction`, { params: { horizon } });
    return response.data;
  },

  /**
   * Fetches batch predictions for monitored watchlist items using single-pass benchmark caching.
   */
  async getWatchlistPredictions(tickers: string[], horizon: string = '1d'): Promise<Record<string, any>> {
    if (!tickers || tickers.length === 0) return {};
    const response = await client.post<Record<string, any>>('/analyze/watchlist-predictions', {
      tickers,
      horizon
    });
    return response.data;
  },

  /**
   * Runs batch quantitative analysis on multiple stock tickers.
   */
  async analyzeMultiple(tickers: string[], timeframe: string = '1d', debug: boolean = false): Promise<DeterministicAnalysisReport[]> {
    const response = await client.post<DeterministicAnalysisReport[]>('/analyze', tickers, {
      params: { timeframe, debug },
    });
    return response.data;
  },

  /**
   * Fetches top stock opportunities computed across liquid market universe.
   */
  async getTopOpportunities(limit: number = 12, forceRefresh: boolean = false): Promise<TopOpportunitiesResponse> {
    const response = await client.get<TopOpportunitiesResponse>('/market/top-opportunities', {
      params: { limit, force_refresh: forceRefresh }
    });
    return response.data;
  },

  /**
   * Generates AI intelligence research report for a stock or analysis payload.
   */
  async getIntelligenceReport(ticker: string, timeframe: string = '1d', analysisReport?: DeterministicAnalysisReport): Promise<DeterministicAnalysisReport> {
    const response = await client.post<DeterministicAnalysisReport>('/intelligence/report', {
      ticker,
      timeframe,
      analysis_report: analysisReport
    });
    return response.data;
  },

  /**
   * Fetches standalone Market Intelligence Pack for a stock.
   */
  async getIntelligenceNews(ticker: string, companyName: string = '', sectorName: string = '') {
    const response = await client.get(`/intelligence/news/${ticker}`, {
      params: { company_name: companyName, sector_name: sectorName }
    });
    return response.data;
  },

  /**
   * Fetches clean historical OHLC chart data for a given stock and timeframe option.
   */
  async getHistoricalChart(ticker: string, timeframe: string = '1D'): Promise<any> {
    const response = await client.get(`/analyze/${ticker}/chart`, { params: { timeframe } });
    return response.data;
  },

  /**
   * Diagnostic mode endpoint returning exchange timezone, market status, and raw candle verification.
   */
  async getChartDiagnostics(ticker: string): Promise<any> {
    const response = await client.get(`/analyze/${ticker}/chart-diagnostics`);
    return response.data;
  },

  /**
   * Fetches recalculated Real-Time Trade Signal for a stock, timeframe option, and position status.
   */
  async getTradeSignal(ticker: string, timeframe: string = '1D', positionStatus: string = 'NO_POSITION'): Promise<TradeSignal> {
    const response = await client.get<TradeSignal>(`/analyze/${ticker}/trade-signal`, {
      params: { timeframe, position_status: positionStatus }
    });
    return response.data;
  },

  /**
   * Fetches full Market Intelligence Dashboard payload for Phase 23.
   */
  async getMarketOverview(forceRefresh: boolean = false) {
    const response = await client.get('/market/overview', {
      params: { force_refresh: forceRefresh }
    });
    return response.data;
  },

  /**
   * Runs a historical strategy simulation for a ticker and returns the
   * equity curve, trade log, and summary performance metrics.
   */
  async runBacktest(ticker: string, period: string = '5y', initialCapital: number = 100000): Promise<BacktestResult> {
    const response = await client.post<BacktestResult>('/backtest/run', {
      ticker, period, initial_capital: initialCapital
    });
    return response.data;
  },
};
