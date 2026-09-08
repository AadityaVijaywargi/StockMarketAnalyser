import { StorageProvider } from './storage_provider';

export class LocalStorageProvider implements StorageProvider {
  getItem(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch (e) {
      console.error(`LocalStorageProvider error reading key '${key}':`, e);
      return null;
    }
  }

  setItem(key: string, value: string): void {
    try {
      localStorage.setItem(key, value);
    } catch (e) {
      console.error(`LocalStorageProvider error writing key '${key}':`, e);
    }
  }

  removeItem(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch (e) {
      console.error(`LocalStorageProvider error removing key '${key}':`, e);
    }
  }
}
