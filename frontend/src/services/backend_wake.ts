/**
 * Detects a sleeping backend. The free Render instance spins down when idle
 * and takes up to ~a minute to boot on the next request; without feedback
 * the app just looks broken during that time (blank panels, a login button
 * that does nothing).
 */

export type WakeState = 'checking' | 'waking' | 'ready' | 'unreachable';

export interface WaitForBackendOptions {
  /** Resolves true once the backend answers. May reject or resolve false on failure. */
  ping: (signal: AbortSignal) => Promise<boolean>;
  onStateChange: (state: WakeState) => void;
  /** Show "waking up" if the first answer takes longer than this. */
  slowAfterMs?: number;
  /** Per-attempt timeout; Render holds requests open while the instance boots. */
  attemptTimeoutMs?: number;
  retryEveryMs?: number;
  giveUpAfterMs?: number;
  /** Stops waiting (e.g. component unmounted). */
  cancelled?: () => boolean;
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function waitForBackend({
  ping,
  onStateChange,
  slowAfterMs = 2500,
  attemptTimeoutMs = 25000,
  retryEveryMs = 3000,
  giveUpAfterMs = 120000,
  cancelled = () => false,
}: WaitForBackendOptions): Promise<WakeState> {
  const startedAt = Date.now();
  let state: WakeState = 'checking';
  const setState = (next: WakeState) => {
    if (next !== state && !cancelled()) {
      state = next;
      onStateChange(next);
    }
  };

  const slowTimer = setTimeout(() => setState('waking'), slowAfterMs);
  try {
    while (!cancelled()) {
      const controller = new AbortController();
      const attemptTimer = setTimeout(() => controller.abort(), attemptTimeoutMs);
      let ok = false;
      try {
        ok = await ping(controller.signal);
      } catch {
        ok = false;
      } finally {
        clearTimeout(attemptTimer);
      }

      if (ok) {
        setState('ready');
        return 'ready';
      }
      if (Date.now() - startedAt >= giveUpAfterMs) {
        setState('unreachable');
        return 'unreachable';
      }
      setState('waking');
      await sleep(retryEveryMs);
    }
    return state;
  } finally {
    clearTimeout(slowTimer);
  }
}
