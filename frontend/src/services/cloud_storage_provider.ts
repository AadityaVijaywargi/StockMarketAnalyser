import { StorageProvider } from './storage_provider';
import { LocalStorageProvider } from './local_storage_provider';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8002';
const TOKEN_KEY = 'stonks_auth_token';
const DEBOUNCE_MS = 600;

/**
 * A StorageProvider that reads/writes localStorage synchronously (so every
 * existing service built on this interface keeps working unmodified) while
 * also pushing writes to the backend in the background and offering an
 * explicit hydrate() to pull the cloud copy down on login. This makes a
 * logged-in user's data follow them across devices instead of living only
 * in one browser's localStorage, without changing any consuming service's
 * synchronous call sites.
 */
export class CloudStorageProvider implements StorageProvider {
  private local = new LocalStorageProvider();
  private debounceTimers: Record<string, ReturnType<typeof setTimeout>> = {};

  getItem(key: string): string | null {
    return this.local.getItem(key);
  }

  setItem(key: string, value: string): void {
    this.local.setItem(key, value);
    this.pushToCloud(key, value);
  }

  removeItem(key: string): void {
    this.local.removeItem(key);
    this.pushToCloud(key, null);
  }

  private pushToCloud(key: string, rawValue: string | null): void {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return;

    clearTimeout(this.debounceTimers[key]);
    this.debounceTimers[key] = setTimeout(() => {
      let value: unknown = null;
      if (rawValue !== null) {
        try {
          value = JSON.parse(rawValue);
        } catch {
          value = rawValue;
        }
      }
      fetch(`${API_BASE_URL}/me/data/${encodeURIComponent(key)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ value }),
      }).catch(() => {
        // Offline or the request failed — localStorage already has the
        // authoritative local copy, next successful write will retry sync.
      });
    }, DEBOUNCE_MS);
  }

  /**
   * Pulls the cloud copy of `key` into localStorage, if one exists.
   * Returns true if it overwrote local data (caller should notify listeners).
   */
  async hydrate(key: string): Promise<boolean> {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return false;

    try {
      const res = await fetch(`${API_BASE_URL}/me/data/${encodeURIComponent(key)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return false;
      const data = await res.json();
      if (data.value !== null && data.value !== undefined) {
        this.local.setItem(key, JSON.stringify(data.value));
        return true;
      }
    } catch {
      // Offline — keep whatever is already in localStorage.
    }
    return false;
  }
}
