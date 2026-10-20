import React, { useCallback, useEffect, useState } from 'react';
import { Briefcase, Download, RotateCcw, Pencil } from 'lucide-react';
import { PaperOrderTicket } from '../components/paper/PaperOrderTicket';
import { PaperBotPanel } from '../components/paper/PaperBotPanel';
import {
  PAPER_ACCOUNT_UPDATED_EVENT,
  PaperAccount,
  PaperOwner,
  PaperPosition,
  PaperTrade,
  paperErrorMessage,
  paperTradingService,
} from '../services/paper_trading_service';
import { formatPrice } from '../utils/formatter';
import { formatSignedRupees, parseOptionalPrice, pnlClass, reasonLabel } from '../utils/paper_format';

const POLL_MS = 15_000;

const OwnerTag: React.FC<{ owner: PaperOwner }> = ({ owner }) => (
  <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold font-mono ${
    owner === 'BOT' ? 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/30' : 'bg-slate-700/60 text-slate-200 border border-slate-600'
  }`}>{owner === 'BOT' ? 'Bot' : 'You'}</span>
);

const StatCard: React.FC<{ label: string; value: string; sub?: string; valueClass?: string }> = ({ label, value, sub, valueClass = 'text-white' }) => (
  <div className="bg-surface border border-borderDark p-4 rounded-2xl flex flex-col gap-1.5 shadow-lg min-w-0">
    <span className="text-xs text-textMuted font-mono font-semibold">{label}</span>
    <div className={`font-mono text-base sm:text-lg font-extrabold whitespace-nowrap ${valueClass}`}>{value}</div>
    {sub && <span className="text-[11px] text-textMuted font-mono">{sub}</span>}
  </div>
);

interface SellPrefill { ticker: string; owner: PaperOwner; quantity: number; companyName: string }

export const PortfolioPage: React.FC = () => {
  const [account, setAccount] = useState<PaperAccount | null>(null);
  const [history, setHistory] = useState<PaperTrade[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sellPrefill, setSellPrefill] = useState<SellPrefill | null>(null);
  const [editing, setEditing] = useState<PaperPosition | null>(null);

  const load = useCallback(async () => {
    try {
      const [acc, trades] = await Promise.all([paperTradingService.getAccount(), paperTradingService.getHistory(200)]);
      setAccount(acc);
      setHistory(trades);
      setLoadError(null);
    } catch (err) {
      setLoadError(paperErrorMessage(err, 'Could not load your paper account. The server may be waking up - retrying shortly.'));
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, POLL_MS);
    window.addEventListener(PAPER_ACCOUNT_UPDATED_EVENT, load);
    return () => {
      clearInterval(id);
      window.removeEventListener(PAPER_ACCOUNT_UPDATED_EVENT, load);
    };
  }, [load]);

  const handleExport = async () => {
    try {
      const blob = await paperTradingService.downloadHistoryCsv();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `paper_trades_${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setLoadError(paperErrorMessage(err, 'Could not export trade history.'));
    }
  };

  const handleReset = async () => {
    if (!window.confirm('Reset your paper account? This clears all holdings and history, restores ₹10,00,000 cash, and switches the bot off.')) return;
    try {
      setAccount(await paperTradingService.reset());
    } catch (err) {
      setLoadError(paperErrorMessage(err, 'Could not reset the account.'));
    }
  };

  const s = account?.summary;
  const youPnl = s ? s.realized_pnl.YOU + s.unrealized_pnl.YOU : 0;
  const botPnl = s ? s.realized_pnl.BOT + s.unrealized_pnl.BOT : 0;
  const winText = (o: PaperOwner) => s ? `${s.wins[o]}W / ${s.losses[o]}L closed` : '';

  return (
    <div className="w-full min-h-screen bg-background text-text font-sans px-4 pb-6 pt-20 sm:px-6 md:px-8 md:pb-8 lg:pt-8 flex flex-col gap-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-borderDark/80 pb-5">
        <div>
          <h1 className="font-extrabold text-2xl text-white tracking-tight flex flex-wrap items-center gap-2.5 font-mono">
            <Briefcase className="w-6 h-6 text-brandText" />
            <span>Paper Trading</span>
            {account && (
              <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold border ${
                account.market_open ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-slate-800 border-slate-700 text-slate-400'
              }`}>{account.market_open ? 'MARKET OPEN' : 'MARKET CLOSED'}</span>
            )}
          </h1>
          <p className="text-xs text-textMuted mt-1">Virtual cash, live NSE prices. Trade yourself, let the bot trade, and compare.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleExport} className="flex items-center gap-2 px-3 py-2 bg-brand/15 border border-brand/40 text-brandText rounded-xl text-xs font-mono font-bold hover:bg-brand/25 cursor-pointer">
            <Download className="w-4 h-4" /> CSV
          </button>
          <button onClick={handleReset} className="flex items-center gap-2 px-3 py-2 bg-slate-800 border border-slate-700 text-slate-300 rounded-xl text-xs font-mono font-bold hover:bg-slate-700 cursor-pointer">
            <RotateCcw className="w-4 h-4" /> Reset
          </button>
        </div>
      </div>

      {loadError && <div className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2">{loadError}</div>}

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
        <StatCard label="Account value" value={formatPrice(s?.equity)} sub={s ? `Started at ${formatPrice(s.starting_cash)}` : undefined} />
        <StatCard label="Total P&L" value={formatSignedRupees(s?.total_pnl)} valueClass={pnlClass(s?.total_pnl)}
          sub={s ? `${((s.total_pnl / s.starting_cash) * 100).toFixed(2)}%` : undefined} />
        <StatCard label="Cash" value={formatPrice(s?.cash)} sub={s ? `Invested ${formatPrice(s.invested)}` : undefined} />
        <StatCard label="Your P&L" value={formatSignedRupees(youPnl)} valueClass={pnlClass(youPnl)} sub={winText('YOU')} />
        <StatCard label="Bot P&L" value={formatSignedRupees(botPnl)} valueClass={pnlClass(botPnl)} sub={winText('BOT')} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 flex flex-col gap-6 min-w-0">
          <section className="bg-surface border border-borderDark rounded-2xl p-5 shadow-lg">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider font-mono mb-3">Holdings</h2>
            {!account ? <p className="text-xs text-textMuted">Loading…</p> : account.positions.length === 0 ? (
              <p className="text-xs text-textMuted">No open positions. Place an order or switch the bot on.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs font-mono">
                  <thead className="text-textMuted text-left">
                    <tr className="border-b border-borderDark">
                      <th className="py-2 pr-3">Stock</th><th className="py-2 pr-3 text-right">Qty</th>
                      <th className="py-2 pr-3 text-right">Avg cost</th><th className="py-2 pr-3 text-right">Price</th>
                      <th className="py-2 pr-3 text-right">P&L</th><th className="py-2 pr-3">Target / Stop</th><th className="py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {account.positions.map(p => (
                      <tr key={`${p.owner}-${p.ticker}`} className="border-b border-borderDark/60">
                        <td className="py-2.5 pr-3">
                          <div className="flex items-center gap-1.5"><OwnerTag owner={p.owner} /><span className="font-bold text-slate-100">{p.ticker.replace('.NS', '')}</span></div>
                          <div className="text-[10px] text-textMuted truncate max-w-[160px]">{p.company_name}</div>
                        </td>
                        <td className="py-2.5 pr-3 text-right">{p.quantity}</td>
                        <td className="py-2.5 pr-3 text-right">{formatPrice(p.avg_cost)}</td>
                        <td className="py-2.5 pr-3 text-right">{formatPrice(p.price)}</td>
                        <td className={`py-2.5 pr-3 text-right ${pnlClass(p.unrealized_pnl)}`}>
                          {formatSignedRupees(p.unrealized_pnl)}<div className="text-[10px]">{p.unrealized_pnl_pct.toFixed(2)}%</div>
                        </td>
                        <td className="py-2.5 pr-3 whitespace-nowrap">
                          <span className="text-emerald-400">{p.target ? formatPrice(p.target) : '—'}</span>
                          <span className="text-slate-600"> / </span>
                          <span className="text-rose-400">{p.stop ? formatPrice(p.stop) : '—'}</span>
                          {p.owner === 'YOU' && (
                            <button aria-label="Edit target and stop" onClick={() => setEditing(p)} className="ml-1.5 text-slate-500 hover:text-slate-200 cursor-pointer align-middle">
                              <Pencil className="w-3 h-3" />
                            </button>
                          )}
                        </td>
                        <td className="py-2.5 text-right">
                          <button onClick={() => setSellPrefill({ ticker: p.ticker, owner: p.owner, quantity: p.quantity, companyName: p.company_name })}
                            className="px-2.5 py-1 rounded-md bg-rose-500/15 border border-rose-500/30 text-rose-300 font-bold hover:bg-rose-500/25 cursor-pointer">Sell</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="bg-surface border border-borderDark rounded-2xl p-5 shadow-lg">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider font-mono mb-3">Trade history</h2>
            {history.length === 0 ? <p className="text-xs text-textMuted">No trades yet.</p> : (
              <div className="overflow-x-auto max-h-[480px] overflow-y-auto">
                <table className="w-full text-xs font-mono">
                  <thead className="text-textMuted text-left sticky top-0 bg-surface">
                    <tr className="border-b border-borderDark">
                      <th className="py-2 pr-3">Time</th><th className="py-2 pr-3">Stock</th><th className="py-2 pr-3">Side</th>
                      <th className="py-2 pr-3 text-right">Qty</th><th className="py-2 pr-3 text-right">Price</th>
                      <th className="py-2 pr-3 text-right">P&L</th><th className="py-2">Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map(t => (
                      <tr key={t.id} className="border-b border-borderDark/60 align-top">
                        <td className="py-2 pr-3 text-slate-400 whitespace-nowrap">
                          {new Date(t.time).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="py-2 pr-3"><div className="flex items-center gap-1.5"><OwnerTag owner={t.owner} />{t.ticker.replace('.NS', '')}</div></td>
                        <td className={`py-2 pr-3 font-bold ${t.side === 'BUY' ? 'text-emerald-400' : 'text-rose-400'}`}>{t.side}</td>
                        <td className="py-2 pr-3 text-right">{t.quantity}</td>
                        <td className="py-2 pr-3 text-right">{formatPrice(t.price)}</td>
                        <td className={`py-2 pr-3 text-right ${pnlClass(t.realized_pnl)}`}>{t.realized_pnl === null ? '—' : formatSignedRupees(t.realized_pnl)}</td>
                        <td className="py-2 text-slate-300">
                          {reasonLabel(t.reason, t.side)}
                          {t.note && <div className="text-[10px] text-amber-400 max-w-[260px] whitespace-normal">{t.note}</div>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>

        <div className="flex flex-col gap-6 min-w-0">
          <PaperOrderTicket account={account} />
          <PaperBotPanel refreshKey={account?.as_of} />
        </div>
      </div>

      {sellPrefill && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4" onClick={() => setSellPrefill(null)}>
          <div className="max-w-md w-full" onClick={e => e.stopPropagation()}>
            <PaperOrderTicket account={account} lockTicker initialTicker={sellPrefill.ticker} initialSide="SELL"
              initialOwner={sellPrefill.owner} initialQuantity={sellPrefill.quantity} companyName={sellPrefill.companyName}
              onClose={() => setSellPrefill(null)} />
          </div>
        </div>
      )}

      {editing && <EditLevelsModal position={editing} onClose={() => setEditing(null)} />}
    </div>
  );
};

const EditLevelsModal: React.FC<{ position: PaperPosition; onClose: () => void }> = ({ position, onClose }) => {
  const [target, setTarget] = useState(position.target ? String(position.target) : '');
  const [stop, setStop] = useState(position.stop ? String(position.stop) : '');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const t = parseOptionalPrice(target);
    const st = parseOptionalPrice(stop);
    if (Number.isNaN(t) || Number.isNaN(st)) {
      setError('Enter positive prices, or leave a field blank to clear it.');
      return;
    }
    setSaving(true);
    try {
      await paperTradingService.setLevels('YOU', position.ticker, t, st);
      onClose();
    } catch (err) {
      setError(paperErrorMessage(err, 'Could not update target/stop.'));
      setSaving(false);
    }
  };

  const input = 'w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm font-mono text-slate-100 focus:outline-none focus:border-brand';
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-surface border border-borderDark rounded-2xl p-5 max-w-sm w-full flex flex-col gap-3" onClick={e => e.stopPropagation()}>
        <h3 className="text-sm font-bold text-white font-mono">{position.ticker.replace('.NS', '')}: target & stop-loss</h3>
        <p className="text-xs text-textMuted">Now {formatPrice(position.price)}. Leave blank to remove. The position sells automatically when either is reached.</p>
        <label className="block"><span className="block text-xs text-slate-300 mb-1">Target ₹</span>
          <input type="number" step="0.05" value={target} onChange={e => setTarget(e.target.value)} className={input} /></label>
        <label className="block"><span className="block text-xs text-slate-300 mb-1">Stop-loss ₹</span>
          <input type="number" step="0.05" value={stop} onChange={e => setStop(e.target.value)} className={input} /></label>
        {error && <p className="text-xs text-rose-400">{error}</p>}
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-1.5 rounded-lg bg-slate-800 text-xs text-slate-300 cursor-pointer">Cancel</button>
          <button onClick={save} disabled={saving} className="px-4 py-1.5 rounded-lg bg-brand text-white text-xs font-bold cursor-pointer">{saving ? 'Saving…' : 'Save'}</button>
        </div>
      </div>
    </div>
  );
};
