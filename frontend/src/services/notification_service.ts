import { StorageProvider } from './storage_provider';
import { LocalStorageProvider } from './local_storage_provider';
import { AppNotification, NotificationSeverity, DeterministicAnalysisReport } from '../types';
import { settingsService } from './settings_service';

export const NOTIFICATIONS_UPDATED_EVENT = 'stonks_notifications_updated';

interface TickerStateRecord {
  recommendation: string;
  confidence: number;
  overallScore: number;
  targetPrice?: number;
  stopLoss?: number;
  tradeSignal?: string;
  lifecycleStatus?: string;
  timestamp: string;
}

export class NotificationService {
  private storage: StorageProvider;
  private storageKey: string;
  private stateKey: string;
  private maxLimit: number;

  constructor(
    storageProvider?: StorageProvider,
    storageKey: string = 'app_notifications',
    stateKey: string = 'watchlist_recommendation_state',
    maxLimit: number = 100
  ) {
    this.storage = storageProvider || new LocalStorageProvider();
    this.storageKey = storageKey;
    this.stateKey = stateKey;
    this.maxLimit = maxLimit;
  }

  private notifyListeners(): void {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(NOTIFICATIONS_UPDATED_EVENT));
    }
  }

  private getKnownStateMap(): Record<string, TickerStateRecord> {
    const raw = this.storage.getItem(this.stateKey);
    if (!raw) return {};
    try {
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }

  private saveKnownStateMap(map: Record<string, TickerStateRecord>): void {
    this.storage.setItem(this.stateKey, JSON.stringify(map));
  }

  getNotifications(): AppNotification[] {
    const raw = this.storage.getItem(this.storageKey);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    } catch (e) {
      console.error('NotificationService error parsing notifications payload:', e);
    }
    return [];
  }

  getUnreadCount(): number {
    return this.getNotifications().filter(n => !n.read).length;
  }

  private saveNotifications(notifications: AppNotification[]): void {
    const capped = notifications.slice(0, this.maxLimit);
    this.storage.setItem(this.storageKey, JSON.stringify(capped));
    this.notifyListeners();
  }

  markAsRead(notificationId: string): void {
    const current = this.getNotifications();
    const updated = current.map(n => n.id === notificationId ? { ...n, read: true } : n);
    this.saveNotifications(updated);
  }

  markAllAsRead(): void {
    const current = this.getNotifications();
    const updated = current.map(n => ({ ...n, read: true }));
    this.saveNotifications(updated);
  }

  deleteNotification(notificationId: string): void {
    const current = this.getNotifications();
    const updated = current.filter(n => n.id !== notificationId);
    this.saveNotifications(updated);
  }

  clearAll(): void {
    this.saveNotifications([]);
  }

  private derivePriority(rec: string): 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' {
    if (['STRONG BUY', 'STRONG SELL'].includes(rec)) return 'CRITICAL';
    if (['BUY', 'SELL', 'ACCUMULATE'].includes(rec)) return 'HIGH';
    if (rec === 'REDUCE') return 'MEDIUM';
    return 'LOW';
  }

  private deriveSeverity(oldRec: string, newRec: string): NotificationSeverity {
    const bullish = ['STRONG BUY', 'BUY', 'ACCUMULATE'];
    const bearish = ['REDUCE', 'SELL', 'STRONG SELL'];

    if ((!bullish.includes(oldRec) && bullish.includes(newRec)) || (!bearish.includes(oldRec) && bearish.includes(newRec))) {
      return 'IMPORTANT';
    }
    if (oldRec === 'STRONG BUY' || oldRec === 'BUY' || newRec === 'HOLD') {
      return 'WARNING';
    }
    return 'INFO';
  }

  private generateChangeReasons(
    report: DeterministicAnalysisReport, 
    prevScore: number, 
    prevConf: number,
    prevTarget?: number,
    prevStop?: number
  ): string[] {
    const reasons: string[] = [];
    const pred = report.prediction;
    const currentConf = pred?.confidence ?? report.scores?.confidence ?? 75.0;
    const targetPrice = pred?.target_price ?? 0.0;
    const stopLoss = pred?.stop_loss ?? 0.0;
    const expectedMove = pred?.expected_move_pct ?? 0.0;

    if (pred && pred.reasons && pred.reasons.length > 0) {
      pred.reasons.forEach(r => reasons.push(r));
    }

    if (Math.abs(currentConf - prevConf) >= 5.0) {
      reasons.push(`Confidence score adjusted from ${prevConf.toFixed(0)}% to ${currentConf.toFixed(0)}%.`);
    }

    if (prevTarget && prevTarget > 0 && Math.abs(targetPrice - prevTarget) / prevTarget >= 0.02) {
      reasons.push(`Target price updated to ₹${targetPrice.toFixed(2)} (Expected move: ${expectedMove >= 0 ? '+' : ''}${expectedMove}%).`);
    }

    if (prevStop && prevStop > 0 && Math.abs(stopLoss - prevStop) / prevStop >= 0.02) {
      reasons.push(`Stop-loss adjusted to ₹${stopLoss.toFixed(2)}.`);
    }

    if (reasons.length === 0) {
      if (report.positive_factors && report.positive_factors.length > 0) {
        reasons.push(`Bullish catalyst: ${report.positive_factors[0]}`);
      } else if (report.negative_factors && report.negative_factors.length > 0) {
        reasons.push(`Risk factor: ${report.negative_factors[0]}`);
      } else {
        reasons.push(`Quantitative model re-calibrated probability engine.`);
      }
    }

    return reasons.slice(0, 4);
  }

  checkAndNotify(report: DeterministicAnalysisReport, isWatched: boolean): void {
    if (!report || !report.ticker || !isWatched) return;
    const prefs = settingsService.getSettings();
    if (!prefs.notificationsEnabled) return;

    const cleanTicker = report.ticker.toUpperCase().trim();
    const stateMap = this.getKnownStateMap();
    const prevState = stateMap[cleanTicker];

    const pred = report.prediction;
    const newRec = pred?.recommendation || report.recommendation || report.scores?.recommendation || 'HOLD';
    const newConf = pred?.confidence ?? report.scores?.confidence ?? 75.0;
    const newScore = report.scores?.overall_score ?? 50.0;
    const newTarget = pred?.target_price;
    const newStop = pred?.stop_loss;
    const expectedMove = pred?.expected_move_pct;

    const newSignal = report.trade_signal?.signal || report.trade_signal?.position_action || 'WAIT';
    const newLifecycle = report.trade_signal?.position_action || 'ENTRY_VALID';

    if (!prevState) {
      stateMap[cleanTicker] = {
        recommendation: newRec,
        confidence: newConf,
        overallScore: newScore,
        targetPrice: newTarget,
        stopLoss: newStop,
        tradeSignal: newSignal,
        lifecycleStatus: newLifecycle,
        timestamp: new Date().toISOString(),
      };
      this.saveKnownStateMap(stateMap);
      return;
    }

    const currentNotifs = this.getNotifications();
    const recChanged = prefs.notifyOnRecommendationChange && prevState.recommendation !== newRec;
    const confShifted = prefs.notifyOnRecommendationChange && Math.abs(prevState.confidence - newConf) >= 10.0;
    const targetShifted = prefs.notifyOnTargetStopShift && prevState.targetPrice && newTarget ? (Math.abs(newTarget - prevState.targetPrice) / prevState.targetPrice >= 0.03) : false;
    const stopShifted = prefs.notifyOnTargetStopShift && prevState.stopLoss && newStop ? (Math.abs(newStop - prevState.stopLoss) / prevState.stopLoss >= 0.03) : false;

    if (recChanged || confShifted || targetShifted || stopShifted) {
      const oldRec = prevState.recommendation;
      const oldConf = prevState.confidence ?? 75.0;
      const oldScore = prevState.overallScore ?? 50.0;

      const severity = this.deriveSeverity(oldRec, newRec);
      const priority = this.derivePriority(newRec);
      const changeReasons = this.generateChangeReasons(report, oldScore, oldConf, prevState.targetPrice, prevState.stopLoss);

      // Check if an existing notification for this ticker exists to group timeline entries
      const existingIdx = currentNotifs.findIndex(n => n.ticker.toUpperCase().trim() === cleanTicker && !n.read);

      if (existingIdx >= 0) {
        const existing = currentNotifs[existingIdx];
        const timeline = existing.timeline || [];
        timeline.push({
          timestamp: existing.timestamp,
          recommendation: existing.new_recommendation,
          confidence: existing.new_confidence,
          reason: existing.change_reason?.[0]
        });

        currentNotifs[existingIdx] = {
          ...existing,
          severity,
          priority,
          old_recommendation: oldRec,
          new_recommendation: newRec,
          old_confidence: oldConf,
          new_confidence: newConf,
          change_reason: changeReasons,
          expected_move_pct: expectedMove,
          target_price: newTarget,
          stop_loss: newStop,
          timestamp: new Date().toISOString(),
          timeline
        };
        this.saveNotifications([...currentNotifs]);
      } else {
        const notification: AppNotification = {
          id: `notif_${cleanTicker}_rec_${Date.now()}`,
          ticker: report.ticker,
          company_name: report.company_name || cleanTicker,
          type: 'RECOMMENDATION_CHANGE',
          category: 'RECOMMENDATIONS',
          priority,
          severity,
          old_recommendation: oldRec,
          new_recommendation: newRec,
          old_confidence: oldConf,
          new_confidence: newConf,
          change_reason: changeReasons,
          expected_move_pct: expectedMove,
          target_price: newTarget,
          stop_loss: newStop,
          timestamp: new Date().toISOString(),
          read: false,
          timeline: []
        };
        this.saveNotifications([notification, ...currentNotifs]);
      }
    }

    stateMap[cleanTicker] = {
      recommendation: newRec,
      confidence: newConf,
      overallScore: newScore,
      targetPrice: newTarget,
      stopLoss: newStop,
      tradeSignal: newSignal,
      lifecycleStatus: newLifecycle,
      timestamp: new Date().toISOString(),
    };
    this.saveKnownStateMap(stateMap);
  }

  notifyPortfolioAlert(params: {
    ticker: string;
    company_name: string;
    old_recommendation: string;
    new_recommendation: string;
    old_confidence: number;
    new_confidence: number;
    change_reason: string[];
    expected_move_pct?: number;
    target_price?: number;
    stop_loss?: number;
  }): void {
    const currentNotifs = this.getNotifications();
    const notification: AppNotification = {
      id: `notif_${params.ticker.toUpperCase().trim()}_portfolio_${Date.now()}`,
      ticker: params.ticker,
      company_name: params.company_name,
      type: 'PORTFOLIO_ALERT',
      category: 'PORTFOLIO',
      priority: 'HIGH',
      severity: 'IMPORTANT',
      old_recommendation: params.old_recommendation,
      new_recommendation: params.new_recommendation,
      old_confidence: params.old_confidence,
      new_confidence: params.new_confidence,
      change_reason: params.change_reason,
      expected_move_pct: params.expected_move_pct,
      target_price: params.target_price,
      stop_loss: params.stop_loss,
      timestamp: new Date().toISOString(),
      read: false,
      timeline: []
    };
    this.saveNotifications([notification, ...currentNotifs]);
  }
}

export const notificationService = new NotificationService();
