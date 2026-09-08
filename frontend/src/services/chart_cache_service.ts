import { ChartData } from '../types';

export class ChartCacheService {
  private static instance: ChartCacheService;
  private cache: Map<string, { timestamp: number; data: ChartData }> = new Map();
  private maxAgeMs: number = 60000; // 60s cache TTL

  private constructor() {}

  static getInstance(): ChartCacheService {
    if (!ChartCacheService.instance) {
      ChartCacheService.instance = new ChartCacheService();
    }
    return ChartCacheService.instance;
  }

  private buildKey(ticker: string, timeframe: string): string {
    return `${ticker.toUpperCase().trim()}:${timeframe.toUpperCase().trim()}`;
  }

  get(ticker: string, timeframe: string): ChartData | null {
    const key = this.buildKey(ticker, timeframe);
    const entry = this.cache.get(key);

    if (!entry) return null;
    if (Date.now() - entry.timestamp > this.maxAgeMs) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  set(ticker: string, timeframe: string, data: ChartData): void {
    const key = this.buildKey(ticker, timeframe);
    this.cache.set(key, {
      timestamp: Date.now(),
      data
    });
  }

  clear(): void {
    this.cache.clear();
  }
}

export const chartCacheService = ChartCacheService.getInstance();
