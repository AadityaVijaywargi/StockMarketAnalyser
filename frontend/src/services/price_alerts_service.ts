import { CloudStorageProvider } from './cloud_storage_provider';
import { PriceAlert } from '../types';

export const PRICE_ALERTS_UPDATED_EVENT = 'stonks_price_alerts_updated';

const STORAGE_KEY = 'stonks_price_alerts';

export class PriceAlertsService {
  private storage = new CloudStorageProvider();

  private notifyListeners(): void {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(PRICE_ALERTS_UPDATED_EVENT));
    }
  }

  async syncFromCloud(): Promise<void> {
    const changed = await this.storage.hydrate(STORAGE_KEY);
    if (changed) this.notifyListeners();
  }

  getAlerts(): PriceAlert[] {
    const raw = this.storage.getItem(STORAGE_KEY);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  getActiveAlertsForTicker(ticker: string): PriceAlert[] {
    const clean = ticker.toUpperCase().trim();
    return this.getAlerts().filter(a => !a.triggered && a.ticker.toUpperCase() === clean);
  }

  private save(alerts: PriceAlert[]): void {
    this.storage.setItem(STORAGE_KEY, JSON.stringify(alerts));
    this.notifyListeners();
  }

  addAlert(ticker: string, companyName: string, targetPrice: number, direction: 'above' | 'below'): PriceAlert {
    const alert: PriceAlert = {
      id: `alert_${ticker.toUpperCase()}_${Date.now()}`,
      ticker: ticker.toUpperCase().trim(),
      company_name: companyName,
      target_price: targetPrice,
      direction,
      created_at: new Date().toISOString(),
      triggered: false,
    };
    this.save([alert, ...this.getAlerts()]);
    return alert;
  }

  removeAlert(id: string): void {
    this.save(this.getAlerts().filter(a => a.id !== id));
  }

  markTriggered(id: string): void {
    const updated = this.getAlerts().map(a =>
      a.id === id ? { ...a, triggered: true, triggered_at: new Date().toISOString() } : a
    );
    this.save(updated);
  }

  /**
   * Checks a live price against active alerts for one ticker and fires
   * notifications for any that just crossed their target. Called from the
   * existing live-quote poll loop rather than any separate timer.
   */
  checkPrice(ticker: string, currentPrice: number, onTrigger: (alert: PriceAlert) => void): void {
    const active = this.getActiveAlertsForTicker(ticker);
    for (const alert of active) {
      const crossed = alert.direction === 'above'
        ? currentPrice >= alert.target_price
        : currentPrice <= alert.target_price;
      if (crossed) {
        this.markTriggered(alert.id);
        onTrigger(alert);
      }
    }
  }
}

export const priceAlertsService = new PriceAlertsService();
