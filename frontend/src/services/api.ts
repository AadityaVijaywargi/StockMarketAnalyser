import axios from 'axios';
import { DeterministicAnalysisReport, LiveQuote, TopOpportunitiesResponse } from '../types';

const API_BASE_URL = 'http://localhost:8000';

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
  async analyzeTicker(ticker: string, timeframe: string = '1d', signal?: AbortSignal, debug: boolean = true): Promise<DeterministicAnalysisReport> {
    const response = await client.get<DeterministicAnalysisReport>(`/analyze/${ticker}`, {
      params: { timeframe, debug },
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
};
