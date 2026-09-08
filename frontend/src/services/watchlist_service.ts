import { StorageProvider } from './storage_provider';
import { CloudStorageProvider } from './cloud_storage_provider';
import { WatchlistItem } from '../types';

export const WATCHLIST_UPDATED_EVENT = 'stonks_watchlist_updated';

export class WatchlistService {
  private storage: StorageProvider;
  private cloudStorage: CloudStorageProvider | null;
  private storageKey: string;

  constructor(storageProvider?: StorageProvider, storageKey: string = 'watchlist') {
    if (storageProvider) {
      this.storage = storageProvider;
      this.cloudStorage = null;
    } else {
      const cloud = new CloudStorageProvider();
      this.storage = cloud;
      this.cloudStorage = cloud;
    }
    this.storageKey = storageKey;
  }

  /**
   * Pulls this user's watchlist down from the backend (if signed in) and,
   * if it differs from what's already in this browser, overwrites local
   * storage and notifies listeners so mounted UI refreshes.
   */
  async syncFromCloud(): Promise<void> {
    if (!this.cloudStorage) return;
    const changed = await this.cloudStorage.hydrate(this.storageKey);
    if (changed) this.notifyListeners();
  }

  /**
   * Helper to normalize ticker symbol (e.g. RELIANCE -> RELIANCE.NS)
   */
  private normalizeTicker(ticker: string): string {
    const clean = (ticker || '').toUpperCase().trim();
    if (!clean) return '';
    return clean.endsWith('.NS') || clean.endsWith('.BO') ? clean : `${clean}.NS`;
  }

  /**
   * Helper to derive readable company name from ticker
   */
  private deriveCompanyName(ticker: string): string {
    const clean = ticker.replace('.NS', '').replace('.BO', '').toUpperCase();
    return clean;
  }

  /**
   * Dispatches custom event to synchronize UI components instantly
   */
  private notifyListeners(): void {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(WATCHLIST_UPDATED_EVENT));
    }
  }

  /**
   * Fetches the current list of saved Watchlist items
   */
  getWatchlist(): WatchlistItem[] {
    const jsonStr = this.storage.getItem(this.storageKey);
    if (!jsonStr) return [];
    try {
      const parsed = JSON.parse(jsonStr);
      if (Array.isArray(parsed)) {
        return parsed.map((item: any) => {
          if (typeof item === 'string') {
            const normalized = item.endsWith('.NS') || item.endsWith('.BO') ? item : `${item}.NS`;
            return {
              id: normalized,
              ticker: normalized,
              company_name: this.deriveCompanyName(normalized),
              exchange: 'NSE',
              date_added: new Date().toISOString(),
              pinned: false,
            };
          }
          return {
            id: item.id || item.ticker,
            ticker: item.ticker,
            company_name: item.company_name || this.deriveCompanyName(item.ticker),
            exchange: item.exchange || 'NSE',
            date_added: item.date_added || new Date().toISOString(),
            pinned: Boolean(item.pinned),
            notes: item.notes || '',
            tags: item.tags || [],
          };
        });
      }
    } catch (e) {
      console.error('WatchlistService error parsing watchlist payload:', e);
    }
    return [];
  }

  /**
   * Checks if a ticker is currently favorited
   */
  isFavorite(ticker: string): boolean {
    if (!ticker) return false;
    const cleanTicker = ticker.toUpperCase().trim();
    const current = this.getWatchlist();
    return current.some(item => item.ticker.toUpperCase() === cleanTicker || item.id.toUpperCase() === cleanTicker);
  }

  /**
   * Adds a stock to the watchlist without duplicates
   */
  addStock(ticker: string, companyName?: string): WatchlistItem[] {
    if (!ticker) return this.getWatchlist();
    const cleanTicker = ticker.toUpperCase().trim();
    const normalizedTicker = cleanTicker.endsWith('.NS') || cleanTicker.endsWith('.BO') ? cleanTicker : `${cleanTicker}.NS`;

    const current = this.getWatchlist();
    const exists = current.some(item => item.ticker.toUpperCase() === normalizedTicker || item.id.toUpperCase() === normalizedTicker);

    if (!exists) {
      const newItem: WatchlistItem = {
        id: normalizedTicker,
        ticker: normalizedTicker,
        company_name: companyName || this.deriveCompanyName(normalizedTicker),
        exchange: 'NSE',
        date_added: new Date().toISOString(),
        pinned: false,
        notes: '',
        tags: [],
      };
      const updated = [...current, newItem];
      this.storage.setItem(this.storageKey, JSON.stringify(updated));
      this.notifyListeners();
      return updated;
    }
    return current;
  }

  /**
   * Removes a stock from the watchlist
   */
  removeStock(ticker: string): WatchlistItem[] {
    if (!ticker) return this.getWatchlist();
    const cleanTicker = ticker.toUpperCase().trim();
    const current = this.getWatchlist();
    const updated = current.filter(item => item.ticker.toUpperCase() !== cleanTicker && item.id.toUpperCase() !== cleanTicker);

    if (updated.length !== current.length) {
      this.storage.setItem(this.storageKey, JSON.stringify(updated));
      this.notifyListeners();
    }
    return updated;
  }

  /**
   * Toggles favorite status for a stock
   */
  toggleFavorite(ticker: string, companyName?: string): { isFavorite: boolean; items: WatchlistItem[] } {
    const currentlyFav = this.isFavorite(ticker);
    if (currentlyFav) {
      const items = this.removeStock(ticker);
      return { isFavorite: false, items };
    } else {
      const items = this.addStock(ticker, companyName);
      return { isFavorite: true, items };
    }
  }

  /**
   * Clears all items from the watchlist
   */
  clearWatchlist(): void {
    this.storage.removeItem(this.storageKey);
    this.notifyListeners();
  }
}

export const watchlistService = new WatchlistService();
