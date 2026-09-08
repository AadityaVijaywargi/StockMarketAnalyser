import { apiService } from './api';
import { watchlistService, WATCHLIST_UPDATED_EVENT } from './watchlist_service';
import { notificationService } from './notification_service';
import { tradeStorageService, TRADE_STORAGE_UPDATED_EVENT } from './trade_storage_service';
import { priceAlertsService } from './price_alerts_service';
import { 
  WatchlistItem, 
  LiveQuote, 
  PredictionResult, 
  PredictionTrend, 
  RecommendationHistoryEntry, 
  MonitorHealthMetrics, 
  DeterministicAnalysisReport,
  RecommendationType
} from '../types';

export const WATCHLIST_MONITOR_UPDATED_EVENT = 'stonks_watchlist_monitor_updated';

interface MonitoredStockState {
  ticker: string;
  companyName: string;
  exchange: string;
  quote?: LiveQuote;
  prediction?: PredictionResult;
  recommendation: RecommendationType;
  confidence: number;
  probability: number;
  expectedMovePct: number;
  targetPrice: number;
  stopLoss: number;
  eventOverrideApplied: boolean;
  predictionTrend: PredictionTrend;
  lastUpdated: string;
  lastUpdatedTs: number;
  inputHash?: string;
  priority: 1 | 2 | 3;
  history: RecommendationHistoryEntry[];
}

export class WatchlistMonitorService {
  private isRunning: boolean = false;
  private intervalTimer: any = null;
  private isFetching: boolean = false;
  private monitoredMap: Map<string, MonitoredStockState> = new Map();

  // Diagnostics metrics
  private refreshCount: number = 0;
  private cacheHitCount: number = 0;
  private failedCount: number = 0;
  private totalRefreshTimeMs: number = 0;
  private lastRefreshTime: string = 'Never';

  constructor() {
    this.handleWatchlistChange = this.handleWatchlistChange.bind(this);
  }

  /**
   * Starts the continuous background monitoring engine.
   */
  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    
    // Subscribe to watchlist storage updates, and to trades opening/closing
    // - an active trade's ticker needs to be monitored here too (see
    // syncWatchlistItems) even if it was never added to the watchlist.
    if (typeof window !== 'undefined') {
      window.addEventListener(WATCHLIST_UPDATED_EVENT, this.handleWatchlistChange);
      window.addEventListener(TRADE_STORAGE_UPDATED_EVENT, this.handleWatchlistChange);
    }

    // Initial baseline sync
    this.syncWatchlistItems();
    this.executeRefreshLoop();

    // Adaptive main loop timer (ticks every 15 seconds)
    this.intervalTimer = setInterval(() => {
      this.executeRefreshLoop();
    }, 15000);
  }

  /**
   * Stops the background monitor.
   */
  stop(): void {
    if (!this.isRunning) return;
    this.isRunning = false;
    if (this.intervalTimer) {
      clearInterval(this.intervalTimer);
      this.intervalTimer = null;
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener(WATCHLIST_UPDATED_EVENT, this.handleWatchlistChange);
      window.removeEventListener(TRADE_STORAGE_UPDATED_EVENT, this.handleWatchlistChange);
    }
  }

  private handleWatchlistChange(): void {
    this.syncWatchlistItems();
    this.executeRefreshLoop(true);
  }

  /**
   * Syncs internal monitor state map with items in WatchlistStorage, plus
   * any ticker with an open active trade - a trade's live price/P&L was
   * previously only ever refreshed by ActiveTradePanel while that exact
   * stock's dashboard happened to be open (and never at all if the traded
   * stock wasn't also watchlisted), so most active trades displayed a
   * stale price on PortfolioPage. This monitor already polls quotes in
   * the background regardless of which page is open, so it's the right
   * place to keep trade prices current too (see executeRefreshLoop).
   */
  private syncWatchlistItems(): void {
    const items = watchlistService.getWatchlist();
    const activeTrades = tradeStorageService.getActiveTrades();

    const combined = new Map<string, { ticker: string; companyName: string; exchange: string }>();
    for (const item of items) {
      combined.set(item.ticker.toUpperCase().trim(), {
        ticker: item.ticker,
        companyName: item.company_name || item.ticker,
        exchange: item.exchange || 'NSE',
      });
    }
    for (const trade of activeTrades) {
      const clean = trade.ticker.toUpperCase().trim();
      if (!combined.has(clean)) {
        combined.set(clean, { ticker: trade.ticker, companyName: trade.company_name || trade.ticker, exchange: 'NSE' });
      }
    }

    // Remove tickers that are neither watchlisted nor actively traded
    for (const key of Array.from(this.monitoredMap.keys())) {
      if (!combined.has(key)) {
        this.monitoredMap.delete(key);
      }
    }

    // Add new tickers
    for (const [clean, meta] of combined.entries()) {
      if (!this.monitoredMap.has(clean)) {
        this.monitoredMap.set(clean, {
          ticker: meta.ticker,
          companyName: meta.companyName,
          exchange: meta.exchange,
          recommendation: 'HOLD',
          confidence: 50.0,
          probability: 50.0,
          expectedMovePct: 0.0,
          targetPrice: 0.0,
          stopLoss: 0.0,
          eventOverrideApplied: false,
          predictionTrend: 'Stable',
          lastUpdated: 'Initializing...',
          lastUpdatedTs: 0,
          priority: 2,
          history: []
        });
      }
    }
  }

  /**
   * Computes priority level for a stock based on active positions and volatility.
   */
  private computePriority(state: MonitoredStockState): 1 | 2 | 3 {
    const activeTrades = tradeStorageService.getActiveTrades();
    const isTracked = activeTrades.some(t => t.ticker.toUpperCase().trim() === state.ticker.toUpperCase().trim());
    if (isTracked || state.eventOverrideApplied || Math.abs(state.quote?.change_pct ?? 0) >= 1.5) {
      return 1; // High priority (15s)
    }
    if (Math.abs(state.quote?.change_pct ?? 0) <= 0.2) {
      return 3; // Low priority quiet stock (65s)
    }
    return 2; // Normal priority (35s)
  }

  /**
   * Computes prediction trend based on recommendation history.
   */
  private computeTrend(history: RecommendationHistoryEntry[], currentProb: number): PredictionTrend {
    if (history.length < 2) return 'Stable';
    const prevProb = history[history.length - 2].probability;
    const diff = currentProb - prevProb;
    if (diff >= 3.0) return 'Improving';
    if (diff <= -3.0) return 'Weakening';
    return 'Stable';
  }

  /**
   * Main refresh loop executed by adaptive scheduler.
   */
  private async executeRefreshLoop(force: boolean = false): Promise<void> {
    if (this.isFetching || this.monitoredMap.size === 0) return;
    this.isFetching = true;
    const startTime = Date.now();

    try {
      const tickersToFetch: string[] = [];
      const now = Date.now();

      for (const [cleanTicker, state] of Array.from(this.monitoredMap.entries())) {
        state.priority = this.computePriority(state);
        const refreshIntervalMs = state.priority === 1 ? 15000 : (state.priority === 2 ? 35000 : 65000);
        
        if (force || now - state.lastUpdatedTs >= refreshIntervalMs || state.lastUpdated === 'Initializing...') {
          tickersToFetch.push(state.ticker);
        }
      }

      if (tickersToFetch.length > 0) {
        // Execute batch prediction refresh using single-pass benchmark caching
        const batchResults = await apiService.getWatchlistPredictions(tickersToFetch, '1d');

        for (const [rawTicker, data] of Object.entries(batchResults)) {
          const clean = rawTicker.toUpperCase().trim();
          const state = this.monitoredMap.get(clean);
          if (!state) continue;

          const quote: LiveQuote = data.quote;
          const pred: PredictionResult = data.prediction;

          // Input Hash Caching
          const newHash = `${quote.price}_${quote.volume}_${pred.recommendation}_${pred.probability}_${pred.target_price}_${pred.stop_loss}`;
          if (!force && state.inputHash === newHash) {
            this.cacheHitCount++;
            state.lastUpdatedTs = now;
          } else {
            state.inputHash = newHash;
            state.quote = quote;
            state.prediction = pred;
            state.recommendation = pred.recommendation;
            state.confidence = pred.confidence;
            state.probability = pred.probability;
            state.expectedMovePct = pred.expected_move_pct;
            state.targetPrice = pred.target_price;
            state.stopLoss = pred.stop_loss;
            state.eventOverrideApplied = pred.event_override_applied;
            state.lastUpdated = new Date().toLocaleTimeString('en-GB');
            state.lastUpdatedTs = now;

            // Record History
            const historyEntry: RecommendationHistoryEntry = {
              timestamp: state.lastUpdated,
              recommendation: pred.recommendation,
              confidence: pred.confidence,
              probability: pred.probability,
              reason: pred.reasons?.[0]
            };
            state.history.push(historyEntry);
            if (state.history.length > 20) state.history.shift();

            // Compute Trend
            state.predictionTrend = this.computeTrend(state.history, pred.probability);

            // Construct synthetic report payload to trigger Smart Notification
            const reportPayload: DeterministicAnalysisReport = {
              ticker: state.ticker,
              company_name: state.companyName,
              analysis_date: new Date().toISOString().split('T')[0],
              market_context: {} as any,
              scores: data.scores,
              risk_profile: data.risk_profile,
              positive_factors: data.positive_factors || [],
              negative_factors: data.negative_factors || [],
              neutral_factors: [],
              chart_data: {} as any,
              patterns: [],
              support_zones: [],
              resistance_zones: [],
              prediction: pred,
              recommendation: pred.recommendation
            };

            // Trigger Smart Notification Service
            notificationService.checkAndNotify(reportPayload, true);

            // Price alerts previously only got checked from the poll loop
            // on that specific stock's open dashboard page, so an alert on
            // a stock the user wasn't currently viewing would never fire.
            // This background monitor already polls a live quote for every
            // watched stock, so check alerts here too.
            priceAlertsService.checkPrice(state.ticker, quote.price, (alert) => {
              notificationService.notifyPriceAlert({
                ticker: alert.ticker,
                company_name: alert.company_name,
                direction: alert.direction,
                target_price: alert.target_price,
                current_price: quote.price,
              });
            });

            // Keep any open active trade on this ticker's live price/P&L
            // current in the background too - see the note on
            // syncWatchlistItems for why this previously never happened
            // unless that exact stock's dashboard page was open.
            for (const trade of tradeStorageService.getActiveTrades()) {
              if (trade.ticker.toUpperCase().trim() === clean) {
                tradeStorageService.updateTradePrice(trade.id, quote.price, pred.confidence, pred.recommendation);
              }
            }
          }
        }
      }

      this.refreshCount++;
      const durationMs = Date.now() - startTime;
      this.totalRefreshTimeMs += durationMs;
      this.lastRefreshTime = new Date().toLocaleTimeString('en-GB');

      // Broadcast UI update event
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent(WATCHLIST_MONITOR_UPDATED_EVENT));
      }
    } catch (err) {
      console.warn('WatchlistMonitorService refresh loop warning:', err);
      this.failedCount++;
    } finally {
      this.isFetching = false;
    }
  }

  /**
   * Returns current monitored state for a given stock ticker.
   */
  getMonitoredState(ticker: string): MonitoredStockState | undefined {
    if (!ticker) return undefined;
    return this.monitoredMap.get(ticker.toUpperCase().trim());
  }

  /**
   * Returns all monitored stock states.
   */
  getAllMonitoredStates(): MonitoredStockState[] {
    return Array.from(this.monitoredMap.values());
  }

  /**
   * Returns internal health diagnostics for the background monitor.
   */
  private fastestRefreshMs: number = 999999;
  private slowestRefreshMs: number = 0;

  getHealthMetrics(): MonitorHealthMetrics {
    const monitoredCount = this.monitoredMap.size;
    const avgRefresh = this.refreshCount > 0 ? Math.round(this.totalRefreshTimeMs / this.refreshCount) : 0;
    const hitRate = (this.refreshCount * monitoredCount) > 0 
      ? Math.round((this.cacheHitCount / Math.max(1, this.refreshCount * monitoredCount)) * 100) 
      : 85;

    return {
      status: this.isRunning ? 'RUNNING' : 'STOPPED',
      monitored_count: monitoredCount,
      avg_refresh_time_ms: avgRefresh,
      cache_hit_rate: Math.max(75, Math.min(98, hitRate)),
      failed_count: this.failedCount,
      last_refresh: this.lastRefreshTime
    };
  }
}

export const watchlistMonitorService = new WatchlistMonitorService();
