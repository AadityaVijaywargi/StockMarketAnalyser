import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Bot, Plus, X } from 'lucide-react';
import { SearchBar } from '../search/SearchBar';
import {
  PAPER_ACCOUNT_UPDATED_EVENT,
  PaperBotSettings,
  paperErrorMessage,
  paperTradingService,
} from '../../services/paper_trading_service';
import { formatPrice } from '../../utils/formatter';

const MAX_TICKERS = 15;

const actionClass: Record<string, string> = {
  BUY: 'text-emerald-400',
  SKIP: 'text-slate-400',
  ERROR: 'text-rose-400',
};

export const PaperBotPanel: React.FC<{ refreshKey?: string }> = ({ refreshKey }) => {
  const [bot, setBot] = useState<PaperBotSettings | null>(null);
  const [tickers, setTickers] = useState<string[]>([]);
  const [budget, setBudget] = useState('');
  const [maxPositions, setMaxPositions] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const syncForm = (b: PaperBotSettings) => {
    setBot(b);
    setTickers(b.tickers);
    setBudget(String(b.budget_per_trade));
    setMaxPositions(String(b.max_positions));
  };

  const formLoaded = useRef(false);
  const load = useCallback(async () => {
    try {
      const b = await paperTradingService.getBot();
      // After the first load, refresh status + log only, so polling never
      // clobbers unsaved form edits.
      if (formLoaded.current) {
        setBot(b);
      } else {
        formLoaded.current = true;
        syncForm(b);
      }
    } catch {
      // The account card already surfaces connectivity errors.
    }
  }, []);

  useEffect(() => { load(); }, [load, refreshKey]);

  useEffect(() => {
    window.addEventListener(PAPER_ACCOUNT_UPDATED_EVENT, load);
    return () => window.removeEventListener(PAPER_ACCOUNT_UPDATED_EVENT, load);
  }, [load]);

  const save = async (changes: Parameters<typeof paperTradingService.updateBot>[0], okText: string) => {
    setSaving(true);
    setMessage(null);
    try {
      const b = await paperTradingService.updateBot(changes);
      syncForm(b);
      setMessage({ ok: true, text: okText });
    } catch (err) {
      setMessage({ ok: false, text: paperErrorMessage(err, 'Could not update the bot.') });
    } finally {
      setSaving(false);
    }
  };

  const dirty = bot !== null && (
    tickers.join(',') !== bot.tickers.join(',') ||
    budget !== String(bot.budget_per_trade) ||
    maxPositions !== String(bot.max_positions)
  );

  if (!bot) {
    return <div className="bg-surface border border-borderDark rounded-2xl p-5 text-xs text-textMuted">Loading bot…</div>;
  }

  return (
    <div className="bg-surface border border-borderDark rounded-2xl p-5 flex flex-col gap-4 shadow-lg">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Bot className="w-5 h-5 text-indigo-400" />
          <h2 className="text-sm font-bold text-white uppercase tracking-wider font-mono">Trading bot</h2>
        </div>
        <button
          role="switch"
          aria-checked={bot.enabled}
          disabled={saving}
          onClick={() => save({ enabled: !bot.enabled }, bot.enabled ? 'Bot switched off.' : 'Bot switched on.')}
          className={`relative w-11 h-6 rounded-full transition-colors cursor-pointer ${bot.enabled ? 'bg-emerald-500' : 'bg-slate-700'}`}
        >
          <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${bot.enabled ? 'left-[22px]' : 'left-0.5'}`} />
          <span className="sr-only">{bot.enabled ? 'Turn bot off' : 'Turn bot on'}</span>
        </button>
      </div>

      <p className="text-xs text-textMuted leading-relaxed">
        Every 5 minutes during market hours, the bot checks each stock below. When the 1D signal is
        <span className="text-emerald-400 font-semibold"> BUY NOW</span>, it buys with the signal's target and stop-loss,
        then sells when either is hit. It only runs while the app's server is awake.
      </p>

      <div>
        <span className="block text-xs font-semibold text-slate-300 mb-1.5">Stocks to watch ({tickers.length}/{MAX_TICKERS})</span>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {tickers.map(t => (
            <span key={t} className="flex items-center gap-1 bg-slate-800 border border-slate-700 rounded-md px-2 py-0.5 text-xs font-mono text-slate-200">
              {t.replace('.NS', '')}
              <button aria-label={`Remove ${t}`} onClick={() => setTickers(tickers.filter(x => x !== t))} className="text-slate-500 hover:text-rose-400 cursor-pointer">
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
          {tickers.length === 0 && <span className="text-xs text-textMuted">No stocks yet.</span>}
        </div>
        {tickers.length < MAX_TICKERS && (
          <div className="flex items-center gap-2">
            <Plus className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            <SearchBar compact placeholder="Add a stock…" onSearch={t => {
              const clean = t.toUpperCase().trim();
              if (clean && !tickers.includes(clean)) setTickers([...tickers, clean]);
            }} />
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="block text-xs font-semibold text-slate-300 mb-1">Budget per trade ₹</span>
          <input type="number" min={1} step={1000} value={budget} onChange={e => setBudget(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm font-mono text-slate-100 focus:outline-none focus:border-brand" />
        </label>
        <label className="block">
          <span className="block text-xs font-semibold text-slate-300 mb-1">Max open positions</span>
          <input type="number" min={1} max={MAX_TICKERS} step={1} value={maxPositions} onChange={e => setMaxPositions(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm font-mono text-slate-100 focus:outline-none focus:border-brand" />
        </label>
      </div>

      {dirty && (
        <button disabled={saving}
          onClick={() => save({ tickers, budget_per_trade: Number(budget), max_positions: Number(maxPositions) }, 'Bot settings saved.')}
          className="self-start px-4 py-1.5 rounded-lg bg-brand hover:bg-indigo-600 text-white text-xs font-bold cursor-pointer">
          {saving ? 'Saving…' : 'Save settings'}
        </button>
      )}
      {message && <p className={`text-xs ${message.ok ? 'text-emerald-400' : 'text-rose-400'}`}>{message.text}</p>}

      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-semibold text-slate-300">Activity</span>
          <span className="text-[11px] text-textMuted font-mono">
            Last run: {bot.last_run_at ? new Date(bot.last_run_at).toLocaleTimeString('en-IN') : 'never'}
          </span>
        </div>
        <ul className="max-h-56 overflow-y-auto flex flex-col gap-1 text-xs font-mono">
          {(bot.log ?? []).length === 0 && <li className="text-textMuted">Nothing yet. Switch the bot on during market hours.</li>}
          {(bot.log ?? []).map((e, i) => (
            <li key={`${e.time}-${e.ticker}-${i}`} className="flex gap-2">
              <span className="text-slate-500 shrink-0">{new Date(e.time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
              <span className={`shrink-0 font-bold ${actionClass[e.action] ?? 'text-slate-400'}`}>{e.action}</span>
              <span className="text-slate-300 shrink-0">{e.ticker.replace('.NS', '')}</span>
              <span className="text-slate-400 truncate" title={e.message}>{e.message}</span>
            </li>
          ))}
        </ul>
        <p className="text-[11px] text-textMuted mt-2">Budget {formatPrice(bot.budget_per_trade)} per trade, up to {bot.max_positions} positions.</p>
      </div>
    </div>
  );
};
