import { beforeEach, describe, expect, it, vi } from 'vitest';

const store = new Map<string, string>();

vi.mock('./cloud_storage_provider', () => ({
  CloudStorageProvider: class {
    getItem(key: string) { return store.get(key) ?? null; }
    setItem(key: string, value: string) { store.set(key, value); }
    removeItem(key: string) { store.delete(key); }
    async hydrate() { return false; }
  },
}));

const { PriceAlertsService } = await import('./price_alerts_service');

describe('PriceAlertsService', () => {
  let service: InstanceType<typeof PriceAlertsService>;

  beforeEach(() => {
    store.clear();
    service = new PriceAlertsService();
  });

  it('normalizes tickers and de-duplicates identical active alerts', () => {
    const first = service.addAlert(' reliance.ns ', 'Reliance', 3000, 'above');
    const again = service.addAlert('RELIANCE.NS', 'Reliance', 3000, 'above');
    expect(again.id).toBe(first.id);
    expect(service.getAlerts()).toHaveLength(1);
    expect(service.getActiveAlertsForTicker('reliance.ns')).toHaveLength(1);
  });

  it('gives alerts created in the same millisecond distinct ids', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000);
    const above = service.addAlert('TCS.NS', 'TCS', 4000, 'above');
    const below = service.addAlert('TCS.NS', 'TCS', 3500, 'below');
    vi.restoreAllMocks();

    expect(above.id).not.toBe(below.id);
    service.removeAlert(above.id);
    expect(service.getAlerts().map(a => a.id)).toEqual([below.id]);
  });

  it('fires "above" alerts at or above target and "below" alerts at or below target', () => {
    service.addAlert('INFY.NS', 'Infosys', 1500, 'above');
    service.addAlert('INFY.NS', 'Infosys', 1400, 'below');
    const fired: number[] = [];
    const onTrigger = (a: { target_price: number }) => fired.push(a.target_price);

    service.checkPrice('INFY.NS', 1450, onTrigger);
    expect(fired).toEqual([]);

    service.checkPrice('INFY.NS', 1500, onTrigger);
    expect(fired).toEqual([1500]);

    service.checkPrice('INFY.NS', 1400, onTrigger);
    expect(fired).toEqual([1500, 1400]);
  });

  it('fires each alert only once and records when it triggered', () => {
    service.addAlert('SBIN.NS', 'SBI', 800, 'above');
    const onTrigger = vi.fn();

    service.checkPrice('SBIN.NS', 810, onTrigger);
    service.checkPrice('SBIN.NS', 820, onTrigger);

    expect(onTrigger).toHaveBeenCalledTimes(1);
    const [alert] = service.getAlerts();
    expect(alert.triggered).toBe(true);
    expect(alert.triggered_at).toBeTruthy();
    expect(service.getActiveAlertsForTicker('SBIN.NS')).toEqual([]);
  });

  it('only checks alerts for the ticker being priced', () => {
    service.addAlert('SBIN.NS', 'SBI', 800, 'above');
    const onTrigger = vi.fn();
    service.checkPrice('HDFCBANK.NS', 5000, onTrigger);
    expect(onTrigger).not.toHaveBeenCalled();
  });

  it('treats corrupt stored data as no alerts', () => {
    store.set('stonks_price_alerts', '{not json');
    expect(service.getAlerts()).toEqual([]);
    store.set('stonks_price_alerts', '{"not":"an array"}');
    expect(service.getAlerts()).toEqual([]);
  });
});
