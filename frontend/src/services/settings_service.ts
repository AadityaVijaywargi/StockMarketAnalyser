const STORAGE_KEY = 'stonks_settings';
export const SETTINGS_UPDATED_EVENT = 'stonks-settings-updated';

export interface AppSettings {
  notificationsEnabled: boolean;
  notifyOnRecommendationChange: boolean;
  notifyOnTargetStopShift: boolean;
}

const DEFAULT_SETTINGS: AppSettings = {
  notificationsEnabled: true,
  notifyOnRecommendationChange: true,
  notifyOnTargetStopShift: true,
};

class SettingsService {
  getSettings(): AppSettings {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { ...DEFAULT_SETTINGS };
      return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  }

  updateSettings(patch: Partial<AppSettings>): AppSettings {
    const next = { ...this.getSettings(), ...patch };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch (e) {
      console.warn('Failed to persist settings:', e);
    }
    window.dispatchEvent(new Event(SETTINGS_UPDATED_EVENT));
    return next;
  }

  /**
   * Clears all app-local data: watchlist, tracked trades, chart layout
   * preferences, drawings, notifications, and recent searches. Leaves
   * this settings key itself untouched. Key list must be kept in sync
   * with every service's actual storage key (they don't share a prefix).
   */
  resetAllData(): void {
    const keysToRemove = [
      'watchlist',
      'stonks_active_trades',
      'stonks_completed_trades',
      'stonks_chart_indicators',
      'stonks_pinned_notifications',
      'stonks_user_chart_drawings',
      'app_notifications',
      'watchlist_recommendation_state',
      'recent_searches',
      'stonks_price_alerts',
    ];
    keysToRemove.forEach(k => localStorage.removeItem(k));
    window.dispatchEvent(new Event(SETTINGS_UPDATED_EVENT));
  }
}

export const settingsService = new SettingsService();
