import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, WifiOff } from 'lucide-react';
import { waitForBackend, WakeState } from '../services/backend_wake';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8002';

const pingBackend = async (signal: AbortSignal) => {
  const response = await fetch(`${API_BASE_URL}/`, { signal });
  return response.ok;
};

/** Floating notice shown only while the backend is cold-starting or unreachable. */
export const BackendWakeBanner: React.FC = () => {
  const [state, setState] = useState<WakeState>('checking');
  const runId = useRef(0);

  const check = useCallback(() => {
    const id = ++runId.current;
    setState('checking');
    waitForBackend({
      ping: pingBackend,
      onStateChange: setState,
      cancelled: () => runId.current !== id,
    });
  }, []);

  useEffect(() => {
    check();
    // runId is a counter, not a DOM ref: bumping it on unmount is exactly
    // what cancels the in-flight wait, so reading .current here is intended.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    return () => { runId.current++; };
  }, [check]);

  if (state !== 'waking' && state !== 'unreachable') return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[100] w-[calc(100%-2rem)] max-w-md bg-surface border border-borderDark rounded-xl shadow-2xl px-4 py-3 flex items-start gap-3 font-mono text-xs"
    >
      {state === 'waking' ? (
        <>
          <Loader2 className="w-4 h-4 mt-0.5 animate-spin text-brandText shrink-0" />
          <div className="flex flex-col gap-0.5">
            <span className="text-white font-bold">Server is waking up…</span>
            <span className="text-textMuted">It sleeps when idle and can take up to a minute to start. The page will work as soon as it's ready.</span>
          </div>
        </>
      ) : (
        <>
          <WifiOff className="w-4 h-4 mt-0.5 text-bearish shrink-0" />
          <div className="flex flex-col gap-1.5">
            <span className="text-white font-bold">Can't reach the server</span>
            <span className="text-textMuted">Check your connection, or try again in a moment.</span>
            <button
              onClick={check}
              className="self-start px-3 py-1 rounded-lg bg-brand/15 border border-brand/40 text-brandText font-bold hover:bg-brand/25 transition-all"
            >
              Retry
            </button>
          </div>
        </>
      )}
    </div>
  );
};
