import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Briefcase } from 'lucide-react';
import { PAPER_ACCOUNT_UPDATED_EVENT, PaperPosition, paperTradingService } from '../../services/paper_trading_service';
import { formatPrice } from '../../utils/formatter';
import { formatSignedRupees, pnlClass } from '../../utils/paper_format';

/** One line per paper position (yours and/or the bot's) in the stock being viewed. Renders nothing if none. */
export const PaperPositionStrip: React.FC<{ ticker: string }> = ({ ticker }) => {
  const [positions, setPositions] = useState<PaperPosition[]>([]);

  const load = useCallback(() => {
    paperTradingService.getAccount()
      .then(acc => setPositions(acc.positions.filter(p => p.ticker === ticker)))
      .catch(() => setPositions([]));
  }, [ticker]);

  useEffect(() => {
    load();
    window.addEventListener(PAPER_ACCOUNT_UPDATED_EVENT, load);
    return () => window.removeEventListener(PAPER_ACCOUNT_UPDATED_EVENT, load);
  }, [load]);

  if (positions.length === 0) return null;

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-xl px-4 py-3 flex flex-col gap-1.5">
      {positions.map(p => (
        <div key={p.owner} className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-mono">
          <span className="flex items-center gap-1.5 text-slate-200 font-bold">
            <Briefcase className="w-3.5 h-3.5 text-brandText" />
            {p.owner === 'BOT' ? "Bot's paper position" : 'Your paper position'}
          </span>
          <span className="text-slate-400">{p.quantity} @ {formatPrice(p.avg_cost)}</span>
          <span className={pnlClass(p.unrealized_pnl)}>{formatSignedRupees(p.unrealized_pnl)} ({p.unrealized_pnl_pct.toFixed(2)}%)</span>
          <span className="text-slate-500">Target {p.target ? formatPrice(p.target) : '—'} · Stop {p.stop ? formatPrice(p.stop) : '—'}</span>
          <Link to="/portfolio" className="ml-auto text-indigo-400 hover:text-indigo-300">Manage →</Link>
        </div>
      ))}
    </div>
  );
};
