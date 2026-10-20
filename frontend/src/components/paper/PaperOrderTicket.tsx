import React, { useEffect, useState } from 'react';
import { Loader2, X } from 'lucide-react';
import { SearchBar } from '../search/SearchBar';
import { apiService } from '../../services/api';
import {
  PaperAccount,
  PaperOwner,
  PaperSide,
  PaperTrade,
  paperErrorMessage,
  paperTradingService,
} from '../../services/paper_trading_service';
import { orderProblem, parseOptionalPrice } from '../../utils/paper_format';
import { formatPrice } from '../../utils/formatter';

interface PaperOrderTicketProps {
  account: PaperAccount | null;
  initialTicker?: string;
  initialSide?: PaperSide;
  initialOwner?: PaperOwner;
  initialQuantity?: number;
  initialTarget?: number | null;
  initialStop?: number | null;
  companyName?: string;
  /** Hide the stock search (ticket opened for a specific stock). */
  lockTicker?: boolean;
  onFilled?: (trade: PaperTrade) => void;
  onClose?: () => void;
}

const inputClass =
  'w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm font-mono text-slate-100 focus:outline-none focus:border-brand';

export const PaperOrderTicket: React.FC<PaperOrderTicketProps> = ({
  account,
  initialTicker = '',
  initialSide = 'BUY',
  initialOwner = 'YOU',
  initialQuantity = 1,
  initialTarget = null,
  initialStop = null,
  companyName,
  lockTicker = false,
  onFilled,
  onClose,
}) => {
  const [ticker, setTicker] = useState(initialTicker);
  const [side, setSide] = useState<PaperSide>(initialSide);
  const [owner, setOwner] = useState<PaperOwner>(initialOwner);
  const [quantity, setQuantity] = useState(String(initialQuantity));
  const [target, setTarget] = useState(initialTarget ? String(initialTarget) : '');
  const [stop, setStop] = useState(initialStop ? String(initialStop) : '');
  const [price, setPrice] = useState<number | null>(null);
  const [priceLoading, setPriceLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filled, setFilled] = useState<PaperTrade | null>(null);

  useEffect(() => {
    if (!ticker) {
      setPrice(null);
      return;
    }
    let cancelled = false;
    setPriceLoading(true);
    apiService.getLiveQuote(ticker)
      .then(q => { if (!cancelled) setPrice(q.price); })
      .catch(() => { if (!cancelled) setPrice(null); })
      .finally(() => { if (!cancelled) setPriceLoading(false); });
    return () => { cancelled = true; };
  }, [ticker]);

  const position = account?.positions.find(p => p.ticker === ticker && p.owner === (side === 'SELL' ? owner : 'YOU'));
  const held = position?.quantity ?? 0;
  const qty = Number(quantity);
  const targetNum = side === 'BUY' ? parseOptionalPrice(target) : null;
  const stopNum = side === 'BUY' ? parseOptionalPrice(stop) : null;
  const problem = ticker
    ? orderProblem({ side, quantity: qty, price, target: targetNum, stop: stopNum, cash: account?.summary.cash ?? 0, held })
    : 'Pick a stock first.';
  const marketClosed = account ? !account.market_open : false;

  const submit = async () => {
    if (problem || marketClosed) return;
    setSubmitting(true);
    setError(null);
    try {
      const trade = await paperTradingService.placeOrder({
        ticker,
        side,
        quantity: qty,
        owner: side === 'SELL' ? owner : 'YOU',
        target: targetNum,
        stop: stopNum,
        company_name: companyName,
      });
      setFilled(trade);
      onFilled?.(trade);
    } catch (err) {
      setError(paperErrorMessage(err, 'The order could not be placed.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-surface border border-borderDark rounded-2xl p-5 flex flex-col gap-4 shadow-lg">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-white uppercase tracking-wider font-mono">Place paper order</h2>
        {onClose && (
          <button onClick={onClose} aria-label="Close" className="text-slate-400 hover:text-white cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {!lockTicker && (
        <div>
          <span className="block text-xs font-semibold text-slate-300 mb-1">Stock</span>
          <SearchBar compact onSearch={t => {
            // The backend normalizes too; doing it here keeps the "held" lookup
            // working when a bare symbol is typed instead of picked.
            const clean = t.toUpperCase().trim();
            setTicker(/^[A-Z0-9&-]+$/.test(clean) ? `${clean}.NS` : clean);
            setFilled(null);
            setError(null);
          }}
            placeholder="Search a stock (e.g. TCS, Reliance)..." />
        </div>
      )}

      {ticker && (
        <div className="flex items-baseline justify-between bg-slate-950/70 border border-slate-800 rounded-lg px-3 py-2">
          <span className="font-mono font-bold text-slate-100">{companyName && lockTicker ? companyName : ticker}</span>
          <span className="font-mono text-sm text-slate-300">
            {priceLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin inline" /> : formatPrice(price)}
          </span>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        {(['BUY', 'SELL'] as PaperSide[]).map(s => (
          <button key={s} onClick={() => { setSide(s); setFilled(null); }}
            className={`py-2 rounded-lg text-xs font-bold cursor-pointer transition-all ${
              side === s
                ? s === 'BUY' ? 'bg-emerald-500 text-slate-950' : 'bg-rose-500 text-white'
                : 'bg-slate-800/80 text-slate-400 hover:text-slate-200'
            }`}>
            {s === 'BUY' ? 'Buy' : 'Sell'}
          </button>
        ))}
      </div>

      {side === 'SELL' && (
        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-400">Sell from:</span>
          {(['YOU', 'BOT'] as PaperOwner[]).map(o => (
            <button key={o} onClick={() => setOwner(o)}
              className={`px-2.5 py-1 rounded-md font-bold cursor-pointer ${owner === o ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400'}`}>
              {o === 'YOU' ? 'Your shares' : "Bot's shares"}
            </button>
          ))}
          <span className="text-slate-500 ml-auto font-mono">Held: {held}</span>
        </div>
      )}

      <label className="block">
        <span className="block text-xs font-semibold text-slate-300 mb-1">Quantity (shares)</span>
        <input type="number" min={1} step={1} value={quantity} onChange={e => setQuantity(e.target.value)} className={inputClass} />
      </label>

      {side === 'BUY' && (
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="block text-xs font-semibold text-slate-300 mb-1">Target ₹ (optional)</span>
            <input type="number" step="0.05" value={target} onChange={e => setTarget(e.target.value)} className={inputClass} />
          </label>
          <label className="block">
            <span className="block text-xs font-semibold text-slate-300 mb-1">Stop-loss ₹ (optional)</span>
            <input type="number" step="0.05" value={stop} onChange={e => setStop(e.target.value)} className={inputClass} />
          </label>
        </div>
      )}

      <div className="flex items-center justify-between text-xs font-mono text-slate-400">
        <span>Est. {side === 'BUY' ? 'cost' : 'proceeds'}: {price !== null && qty > 0 ? formatPrice(qty * price) : '--'}</span>
        <span>Cash: {formatPrice(account?.summary.cash)}</span>
      </div>

      {marketClosed && (
        <p className="text-xs text-amber-400">The market is closed. Orders fill during NSE hours, Mon–Fri 9:15 AM – 3:30 PM IST.</p>
      )}
      {!marketClosed && ticker && problem && <p className="text-xs text-amber-400">{problem}</p>}
      {error && <p className="text-xs text-rose-400">{error}</p>}
      {filled && (
        <p className="text-xs text-emerald-400">
          {filled.side === 'BUY' ? 'Bought' : 'Sold'} {filled.quantity} {filled.ticker} at {formatPrice(filled.price)}.
        </p>
      )}

      <button onClick={submit} disabled={!!problem || marketClosed || submitting}
        className={`w-full py-2.5 rounded-lg text-sm font-bold transition-all ${
          problem || marketClosed || submitting
            ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
            : side === 'BUY' ? 'bg-emerald-500 hover:bg-emerald-600 text-slate-950 cursor-pointer' : 'bg-rose-500 hover:bg-rose-600 text-white cursor-pointer'
        }`}>
        {submitting ? 'Placing…' : `${side === 'BUY' ? 'Buy' : 'Sell'} at market`}
      </button>
      <p className="text-[11px] text-textMuted">Paper trading only. Fills at the live price when you submit; no real money is used.</p>
    </div>
  );
};
