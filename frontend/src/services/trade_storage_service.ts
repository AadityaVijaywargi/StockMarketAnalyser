import { StorageProvider } from './storage_provider';
import { CloudStorageProvider } from './cloud_storage_provider';
import { TrackedTrade, TradePerformanceSummary, TradeStatus } from '../types';
import { notificationService } from './notification_service';

export const TRADE_STORAGE_UPDATED_EVENT = 'stonks_trades_updated';

export class TradeStorageService {
  private storage: StorageProvider;
  private cloudStorage: CloudStorageProvider | null;
  private activeKey: string;
  private completedKey: string;

  constructor(
    storageProvider?: StorageProvider,
    activeKey: string = 'stonks_active_trades',
    completedKey: string = 'stonks_completed_trades'
  ) {
    if (storageProvider) {
      this.storage = storageProvider;
      this.cloudStorage = null;
    } else {
      const cloud = new CloudStorageProvider();
      this.storage = cloud;
      this.cloudStorage = cloud;
    }
    this.activeKey = activeKey;
    this.completedKey = completedKey;
  }

  /** Pulls this user's active + completed trades down from the backend. */
  async syncFromCloud(): Promise<void> {
    if (!this.cloudStorage) return;
    const [activeChanged, completedChanged] = await Promise.all([
      this.cloudStorage.hydrate(this.activeKey),
      this.cloudStorage.hydrate(this.completedKey),
    ]);
    if (activeChanged || completedChanged) this.notifyListeners();
  }

  private notifyListeners(): void {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(TRADE_STORAGE_UPDATED_EVENT));
    }
  }

  /**
   * Reads all active tracked trades
   */
  getActiveTrades(): TrackedTrade[] {
    const raw = this.storage.getItem(this.activeKey);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  /**
   * Reads all completed trade history
   */
  getCompletedTrades(): TrackedTrade[] {
    const raw = this.storage.getItem(this.completedKey);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  private saveActiveTrades(trades: TrackedTrade[]): void {
    this.storage.setItem(this.activeKey, JSON.stringify(trades));
    this.notifyListeners();
  }

  private saveCompletedTrades(trades: TrackedTrade[]): void {
    this.storage.setItem(this.completedKey, JSON.stringify(trades));
    this.notifyListeners();
  }

  /**
   * Starts tracking a new trade with Phase 30 configurability
   */
  startTrade(params: {
    ticker: string;
    company_name: string;
    entry_price: number;
    quantity?: number;
    timeframe?: string;
    target_price: number;
    stop_loss: number;
    confidence?: number;
    signal?: string;
    enable_trailing_stop?: boolean;
    enable_auto_exit_target?: boolean;
    enable_auto_exit_stop?: boolean;
    trade_notes?: string;
    tracker_type?: 'BUY' | 'SELL';
    avg_buy_price?: number;
  }): TrackedTrade {
    const active = this.getActiveTrades();
    const cleanTicker = params.ticker.toUpperCase().trim();

    const trackerType = params.tracker_type || 'BUY';
    const entryPrice = trackerType === 'SELL' && params.avg_buy_price ? params.avg_buy_price : params.entry_price;
    const qty = Math.max(params.quantity || 1, 1);

    const investmentVal = Number((entryPrice * qty).toFixed(2));
    const targetPrice = params.target_price || (entryPrice * 1.1);
    const stopLoss = params.stop_loss || (entryPrice * 0.95);

    const upside = Math.max(targetPrice - entryPrice, 0.1);
    const downside = Math.max(entryPrice - stopLoss, 0.1);
    const rrRatio = Number((upside / downside).toFixed(2));

    const expectedProfit = Number((upside * qty).toFixed(2));
    const maxLoss = Number((downside * qty).toFixed(2));

    const distTargetPct = Number((((targetPrice - entryPrice) / entryPrice) * 100).toFixed(2));
    const distStopPct = Number((((entryPrice - stopLoss) / entryPrice) * 100).toFixed(2));

    const newTrade: TrackedTrade = {
      id: `trade_${cleanTicker}_${trackerType}_${Date.now()}`,
      ticker: cleanTicker,
      company_name: params.company_name || cleanTicker,
      tracker_type: trackerType,
      quantity: qty,
      avg_buy_price: params.avg_buy_price || entryPrice,
      entry_price: entryPrice,
      current_price: entryPrice,
      investment_value: investmentVal,
      entry_time: new Date().toISOString(),
      timeframe: params.timeframe || '1D',
      target_price: targetPrice,
      initial_stop_loss: stopLoss,
      trailing_stop_loss: stopLoss,

      enable_trailing_stop: params.enable_trailing_stop ?? true,
      enable_auto_exit_target: params.enable_auto_exit_target ?? true,
      enable_auto_exit_stop: params.enable_auto_exit_stop ?? true,
      trade_notes: params.trade_notes || '',

      risk_reward_ratio: rrRatio,
      expected_profit: expectedProfit,
      max_loss: maxLoss,

      profit_pct: 0.0,
      profit_amount: 0.0,
      distance_to_target_pct: distTargetPct,
      distance_to_stop_pct: distStopPct,
      highest_profit_pct: 0.0,
      max_drawdown_pct: 0.0,
      target_progress_pct: 0.0,
      holding_time_mins: 0,

      initial_confidence: params.confidence || 85,
      initial_signal: params.signal || 'BUY NOW',
      ai_confidence_at_entry: params.confidence || 85,
      ai_recommendation_at_entry: params.signal || 'BUY NOW',

      status: 'ACTIVE',
      exit_recommendation: 'HOLD',
    };

    const updated = [newTrade, ...active];
    this.saveActiveTrades(updated);

    // Trigger Notification
    notificationService.notifyPortfolioAlert({
      ticker: cleanTicker,
      company_name: params.company_name || cleanTicker,
      old_recommendation: 'NO_POSITION',
      new_recommendation: 'ACTIVE_POSITION',
      old_confidence: 0,
      new_confidence: params.confidence || 85,
      change_reason: [`New ${trackerType} trade opened at ₹${entryPrice.toFixed(2)} (${qty} shares). Target: ₹${targetPrice}, Stop: ₹${stopLoss}.`],
      expected_move_pct: distTargetPct,
      target_price: targetPrice,
      stop_loss: stopLoss,
    });

    return newTrade;
  }

  startBuyTracker(params: {
    ticker: string;
    company_name: string;
    entry_price: number;
    quantity?: number;
    timeframe?: string;
    target_price: number;
    stop_loss: number;
    confidence?: number;
    signal?: string;
    enable_trailing_stop?: boolean;
    enable_auto_exit_target?: boolean;
    enable_auto_exit_stop?: boolean;
    trade_notes?: string;
  }): TrackedTrade {
    return this.startTrade({ ...params, tracker_type: 'BUY' });
  }

  startSellTracker(params: {
    ticker: string;
    company_name: string;
    current_price: number;
    avg_buy_price?: number;
    quantity?: number;
    timeframe?: string;
    trailing_stop?: number;
    target_price?: number;
    confidence?: number;
    signal?: string;
  }): TrackedTrade {
    return this.startTrade({
      ticker: params.ticker,
      company_name: params.company_name,
      entry_price: params.current_price,
      avg_buy_price: params.avg_buy_price,
      quantity: params.quantity || 1,
      timeframe: params.timeframe,
      target_price: params.target_price || params.current_price * 1.1,
      stop_loss: params.trailing_stop || params.current_price * 0.95,
      confidence: params.confidence,
      signal: params.signal,
      tracker_type: 'SELL'
    });
  }

  /**
   * Live updates an active trade with latest price & checks auto-exit criteria
   */
  updateTradePrice(
    tradeId: string, 
    currentPrice: number,
    currentAiConfidence?: number,
    currentAiRecommendation?: string
  ): TrackedTrade | null {
    const active = this.getActiveTrades();
    const tradeIndex = active.findIndex(t => t.id === tradeId);
    if (tradeIndex === -1) return null;

    const trade = active[tradeIndex];
    const entryPrice = trade.entry_price;
    const targetPrice = trade.target_price;
    const initialStop = trade.initial_stop_loss;
    let currTrailingStop = trade.trailing_stop_loss || initialStop;
    const qty = trade.quantity || 1;

    const profitAmount = Number(((currentPrice - entryPrice) * qty).toFixed(2));
    const profitPct = Number((((currentPrice - entryPrice) / entryPrice) * 100).toFixed(2));

    const highestProfit = Math.max(trade.highest_profit_pct || 0, profitPct);
    const currDrawdown = profitPct < 0 ? profitPct : 0;
    const maxDrawdown = Math.min(trade.max_drawdown_pct || 0, currDrawdown);

    // Distances
    const distTargetPct = Number((((targetPrice - currentPrice) / currentPrice) * 100).toFixed(2));
    const distStopPct = Number((((currentPrice - currTrailingStop) / currentPrice) * 100).toFixed(2));

    // Target Progress %
    const denom = Math.max(targetPrice - entryPrice, 0.1);
    const rawProgress = ((currentPrice - entryPrice) / denom) * 100;
    const targetProgress = Number(Math.min(Math.max(rawProgress, 0), 100).toFixed(1));

    // Trailing Stop Loss Logic
    let newTrailingStop = currTrailingStop;
    if (trade.enable_trailing_stop) {
      if (profitPct >= 2.0) {
        const suggested = entryPrice + ((currentPrice - entryPrice) * 0.5);
        newTrailingStop = Math.max(currTrailingStop, suggested);
      } else if (profitPct >= 1.0) {
        newTrailingStop = Math.max(currTrailingStop, entryPrice);
      }
    }
    newTrailingStop = Number(newTrailingStop.toFixed(2));

    // Holding time calculation in minutes
    const startTime = new Date(trade.entry_time).getTime();
    const nowTime = Date.now();
    const holdingMins = Math.max(Math.floor((nowTime - startTime) / 60000), 1);

    // Lifecycle Status & Exit Rule Checks
    let status: TradeStatus = trade.status;
    let exitRec: 'HOLD' | 'EXIT NOW' | 'TAKE PROFIT' | 'STOP LOSS HIT' | 'PARTIAL SELL' = 'HOLD';
    let exitReason = trade.exit_reason;
    let shouldAutoExit = false;

    // Check Auto Exits
    if (trade.enable_auto_exit_target && currentPrice >= targetPrice) {
      status = 'TARGET_REACHED';
      exitRec = 'TAKE PROFIT';
      exitReason = `Profit Target of ₹${targetPrice} achieved (+${profitPct}% P/L).`;
      shouldAutoExit = true;
    } else if (trade.enable_auto_exit_stop && currentPrice <= initialStop) {
      status = 'STOP_LOSS_REACHED';
      exitRec = 'STOP LOSS HIT';
      exitReason = `Initial Stop Loss triggered at ₹${initialStop} (${profitPct}% P/L).`;
      shouldAutoExit = true;
    } else if (trade.enable_trailing_stop && currentPrice <= newTrailingStop && newTrailingStop > initialStop) {
      status = 'TRAILING_STOP_REACHED';
      exitRec = 'STOP LOSS HIT';
      exitReason = `Trailing Stop Loss triggered at ₹${newTrailingStop} (+${profitPct}% P/L locked).`;
      shouldAutoExit = true;
    } else if (targetProgress >= 85) {
      status = 'TARGET_NEAR';
      exitRec = 'TAKE PROFIT';
      exitReason = `Within 15% of profit target (Progress: ${targetProgress}%).`;
    }

    const updatedTrade: TrackedTrade = {
      ...trade,
      current_price: currentPrice,
      profit_pct: profitPct,
      profit_amount: profitAmount,
      distance_to_target_pct: distTargetPct,
      distance_to_stop_pct: distStopPct,
      highest_profit_pct: highestProfit,
      max_drawdown_pct: maxDrawdown,
      target_progress_pct: targetProgress,
      trailing_stop_loss: newTrailingStop,
      holding_time_mins: holdingMins,
      ai_confidence_at_exit: currentAiConfidence || trade.ai_confidence_at_entry,
      ai_recommendation_at_exit: currentAiRecommendation || trade.ai_recommendation_at_entry,
      status,
      exit_recommendation: exitRec,
      exit_reason: exitReason
    };

    if (shouldAutoExit) {
      // Auto close and move to history
      return this.closeTrade(
        tradeId, 
        currentPrice, 
        exitReason, 
        status, 
        currentAiConfidence, 
        currentAiRecommendation
      );
    }

    active[tradeIndex] = updatedTrade;
    this.saveActiveTrades(active);
    return updatedTrade;
  }

  /**
   * Closes an active trade and moves it to completed trade history
   */
  closeTrade(
    tradeId: string, 
    exitPrice?: number, 
    exitReason?: string, 
    exitStatus?: TradeStatus,
    exitAiConfidence?: number,
    exitAiRecommendation?: string
  ): TrackedTrade | null {
    const active = this.getActiveTrades();
    const tradeIndex = active.findIndex(t => t.id === tradeId);
    if (tradeIndex === -1) return null;

    const trade = active[tradeIndex];
    const finalExitPrice = exitPrice !== undefined ? exitPrice : trade.current_price;
    const entryPrice = trade.entry_price;
    const qty = trade.quantity || 1;

    const finalProfitAmount = Number(((finalExitPrice - entryPrice) * qty).toFixed(2));
    const finalProfitPct = Number((((finalExitPrice - entryPrice) / entryPrice) * 100).toFixed(2));

    const startTime = new Date(trade.entry_time).getTime();
    const nowTime = Date.now();
    const holdingMins = Math.max(Math.floor((nowTime - startTime) / 60000), 1);

    const finalStatus: TradeStatus = exitStatus || (finalProfitPct >= 0 ? 'TARGET_REACHED' : 'MANUAL_EXIT');

    const completedTrade: TrackedTrade = {
      ...trade,
      current_price: finalExitPrice,
      profit_pct: finalProfitPct,
      profit_amount: finalProfitAmount,
      holding_time_mins: holdingMins,
      status: finalStatus,
      exit_price: finalExitPrice,
      exit_time: new Date().toISOString(),
      exit_reason: exitReason || trade.exit_reason || 'Manual trade exit executed.',
      exit_signal: finalStatus,
      ai_confidence_at_exit: exitAiConfidence || trade.initial_confidence,
      ai_recommendation_at_exit: exitAiRecommendation || trade.initial_signal,
    };

    // Remove from active list
    const updatedActive = active.filter(t => t.id !== tradeId);
    this.saveActiveTrades(updatedActive);

    // Save to completed list
    const completed = this.getCompletedTrades();
    this.saveCompletedTrades([completedTrade, ...completed]);

    // Dispatch Notification Alert
    notificationService.notifyPortfolioAlert({
      ticker: trade.ticker,
      company_name: trade.company_name,
      old_recommendation: 'ACTIVE_POSITION',
      new_recommendation: finalProfitPct >= 0 ? 'PROFIT_EXIT' : 'LOSS_EXIT',
      old_confidence: trade.initial_confidence,
      new_confidence: exitAiConfidence || trade.initial_confidence,
      change_reason: [`Trade Closed: ${completedTrade.exit_reason}`],
      expected_move_pct: finalProfitPct,
      target_price: trade.target_price,
      stop_loss: trade.initial_stop_loss,
    });

    return completedTrade;
  }

  /**
   * Calculates comprehensive performance dashboard summary from active and completed trades
   */
  getPerformanceSummary(): TradePerformanceSummary {
    const active = this.getActiveTrades();
    const completed = this.getCompletedTrades();
    const totalTrades = completed.length;

    const wins = completed.filter(t => t.profit_pct > 0);
    const losses = completed.filter(t => t.profit_pct <= 0);

    const winCount = wins.length;
    const lossCount = losses.length;
    const winRate = totalTrades > 0 ? Number(((winCount / totalTrades) * 100).toFixed(1)) : 0;

    const totalGain = wins.reduce((sum, t) => sum + t.profit_pct, 0);
    const totalLoss = losses.reduce((sum, t) => sum + Math.abs(t.profit_pct), 0);

    const avgGain = wins.length > 0 ? Number((totalGain / wins.length).toFixed(2)) : 0;
    const avgLoss = losses.length > 0 ? Number((totalLoss / losses.length).toFixed(2)) : 0;

    const overallRR = avgLoss > 0 ? Number((avgGain / avgLoss).toFixed(2)) : avgGain > 0 ? avgGain : 1.0;

    const totalRealizedPnl = Number(completed.reduce((sum, t) => sum + t.profit_amount, 0).toFixed(2));

    const largestWin = wins.length > 0 ? Math.max(...wins.map(t => t.profit_pct)) : 0;
    const largestLoss = losses.length > 0 ? Math.min(...losses.map(t => t.profit_pct)) : 0;

    // AI Recommendation Accuracy calculation
    const accurateAiTrades = completed.filter(t => {
      const entrySignal = (t.ai_recommendation_at_entry || t.initial_signal || '').toUpperCase();
      const isBullishSignal = entrySignal.includes('BUY');
      const isProfitable = t.profit_pct > 0;
      return (isBullishSignal && isProfitable) || (!isBullishSignal && !isProfitable);
    });

    const aiAccuracy = totalTrades > 0 ? Number(((accurateAiTrades.length / totalTrades) * 100).toFixed(1)) : 88.5;

    const totalMins = completed.reduce((sum, t) => sum + (t.holding_time_mins || 1), 0);
    const avgMins = totalTrades > 0 ? Math.floor(totalMins / totalTrades) : 0;

    let avgHoldingStr = `${avgMins} mins`;
    if (avgMins >= 1440) {
      avgHoldingStr = `${Math.floor(avgMins / 1440)}d ${Math.floor((avgMins % 1440) / 60)}h`;
    } else if (avgMins >= 60) {
      avgHoldingStr = `${Math.floor(avgMins / 60)}h ${avgMins % 60}m`;
    }

    return {
      total_trades: totalTrades + active.length,
      active_trades: active.length,
      closed_trades: totalTrades,
      winning_trades: winCount,
      losing_trades: lossCount,
      win_rate_pct: winRate,
      average_gain_pct: avgGain,
      average_loss_pct: avgLoss,
      risk_reward_ratio: overallRR,
      ai_accuracy_pct: aiAccuracy,
      largest_win_pct: Number(largestWin.toFixed(2)),
      largest_loss_pct: Number(largestLoss.toFixed(2)),
      total_realized_pnl: totalRealizedPnl,
      average_holding_time: avgHoldingStr
    };
  }

  /**
   * Generates CSV export content for completed and active trades
   */
  exportToCSV(): string {
    const active = this.getActiveTrades();
    const completed = this.getCompletedTrades();
    const allTrades = [...active, ...completed];

    const headers = [
      'Trade ID', 'Ticker', 'Company', 'Status', 'Quantity', 'Entry Price', 
      'Exit Price', 'P/L Amount', 'P/L %', 'Investment Value', 'Target Price', 
      'Stop Loss', 'Risk/Reward Ratio', 'Entry Time', 'Exit Time', 'Exit Reason', 
      'AI Rec at Entry', 'AI Rec at Exit', 'Notes'
    ];

    const rows = allTrades.map(t => [
      t.id,
      t.ticker,
      `"${t.company_name.replace(/"/g, '""')}"`,
      t.status,
      t.quantity,
      t.entry_price,
      t.exit_price || t.current_price,
      t.profit_amount,
      `${t.profit_pct}%`,
      t.investment_value,
      t.target_price,
      t.initial_stop_loss,
      t.risk_reward_ratio,
      t.entry_time,
      t.exit_time || 'N/A',
      `"${(t.exit_reason || '').replace(/"/g, '""')}"`,
      t.ai_recommendation_at_entry || t.initial_signal,
      t.ai_recommendation_at_exit || 'N/A',
      `"${(t.trade_notes || '').replace(/"/g, '""')}"`
    ]);

    return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  }

  /**
   * Permanently deletes an individual trade from active or completed history
   */
  deleteTrade(tradeId: string): boolean {
    const active = this.getActiveTrades();
    const updatedActive = active.filter(t => t.id !== tradeId);
    if (updatedActive.length !== active.length) {
      this.saveActiveTrades(updatedActive);
      return true;
    }

    const completed = this.getCompletedTrades();
    const updatedCompleted = completed.filter(t => t.id !== tradeId);
    if (updatedCompleted.length !== completed.length) {
      this.saveCompletedTrades(updatedCompleted);
      return true;
    }

    return false;
  }

  /**
   * Permanently clears all completed trade history
   */
  clearTradeHistory(): void {
    this.saveCompletedTrades([]);
  }
}

export const tradeStorageService = new TradeStorageService();
