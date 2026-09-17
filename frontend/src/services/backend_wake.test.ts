import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { waitForBackend, WakeState } from './backend_wake';

describe('waitForBackend', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const resolveAfter = (ms: number, value: boolean) => () =>
    new Promise<boolean>(resolve => setTimeout(() => resolve(value), ms));

  it('goes straight to ready (no banner) when the backend answers quickly', async () => {
    const states: WakeState[] = [];
    const done = waitForBackend({ ping: resolveAfter(200, true), onStateChange: s => states.push(s) });
    await vi.advanceTimersByTimeAsync(200);
    expect(await done).toBe('ready');
    expect(states).toEqual(['ready']);
  });

  it('shows "waking" while a slow cold start is in progress, then ready', async () => {
    const states: WakeState[] = [];
    const done = waitForBackend({ ping: resolveAfter(40000, true), onStateChange: s => states.push(s), attemptTimeoutMs: 60000 });
    await vi.advanceTimersByTimeAsync(2500);
    expect(states).toEqual(['waking']);
    await vi.advanceTimersByTimeAsync(37500);
    expect(await done).toBe('ready');
    expect(states).toEqual(['waking', 'ready']);
  });

  it('retries failed pings until one succeeds', async () => {
    const ping = vi.fn()
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);
    const done = waitForBackend({ ping, onStateChange: () => {}, retryEveryMs: 1000 });
    await vi.advanceTimersByTimeAsync(2000);
    expect(await done).toBe('ready');
    expect(ping).toHaveBeenCalledTimes(3);
  });

  it('aborts an attempt that hangs past the per-attempt timeout', async () => {
    let aborted = false;
    const ping = vi.fn((signal: AbortSignal) => new Promise<boolean>((resolve, reject) => {
      if (ping.mock.calls.length > 1) return resolve(true);
      signal.addEventListener('abort', () => { aborted = true; reject(new Error('aborted')); });
    }));
    const done = waitForBackend({ ping, onStateChange: () => {}, attemptTimeoutMs: 5000, retryEveryMs: 1000 });
    await vi.advanceTimersByTimeAsync(6000);
    expect(aborted).toBe(true);
    expect(await done).toBe('ready');
  });

  it('gives up as unreachable after the overall deadline', async () => {
    const states: WakeState[] = [];
    const done = waitForBackend({
      ping: async () => false, onStateChange: s => states.push(s), retryEveryMs: 1000, giveUpAfterMs: 5000,
    });
    await vi.advanceTimersByTimeAsync(6000);
    expect(await done).toBe('unreachable');
    expect(states.at(-1)).toBe('unreachable');
  });

  it('stops reporting once cancelled', async () => {
    let cancelled = false;
    const states: WakeState[] = [];
    const done = waitForBackend({
      ping: async () => false, onStateChange: s => states.push(s), retryEveryMs: 1000, cancelled: () => cancelled,
    });
    await vi.advanceTimersByTimeAsync(100);
    expect(states).toEqual(['waking']);
    cancelled = true;
    await vi.advanceTimersByTimeAsync(200000);
    await done;
    expect(states).toEqual(['waking']);
  });
});
