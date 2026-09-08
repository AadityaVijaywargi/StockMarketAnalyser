import React, { useState, useEffect } from 'react';
import { TrackedTrade, TradePerformanceSummary } from '../types';
import { tradeStorageService, TRADE_STORAGE_UPDATED_EVENT } from '../services/trade_storage_service';
import { 
  Trophy, 
  TrendingUp, 
  TrendingDown, 
  Clock, 
  BarChart3, 
  CheckCircle2, 
  XCircle,
  History,
  Trash2
} from 'lucide-react';

export const TradePerformanceDashboard: React.FC = () => {
  const [summary, setSummary] = useState<TradePerformanceSummary>(tradeStorageService.getPerformanceSummary());
  const [completedTrades, setCompletedTrades] = useState<TrackedTrade[]>(tradeStorageService.getCompletedTrades());
  const [activeTab, setActiveTab] = useState<'SUMMARY' | 'HISTORY'>('SUMMARY');
  const [tradeToDelete, setTradeToDelete] = useState<TrackedTrade | null>(null);
  const [isConfirmClearOpen, setIsConfirmClearOpen] = useState<boolean>(false);

  const reloadData = () => {
    setSummary(tradeStorageService.getPerformanceSummary());
    setCompletedTrades(tradeStorageService.getCompletedTrades());
  };

  useEffect(() => {
    reloadData();
    const handleUpdate = () => reloadData();
    window.addEventListener(TRADE_STORAGE_UPDATED_EVENT, handleUpdate);
    return () => window.removeEventListener(TRADE_STORAGE_UPDATED_EVENT, handleUpdate);
  }, []);

  const handleDeleteSingle = () => {
    if (!tradeToDelete) return;
    tradeStorageService.deleteTrade(tradeToDelete.id);
    setTradeToDelete(null);
    reloadData();
  };

  const handleClearAll = () => {
    tradeStorageService.clearTradeHistory();
    setIsConfirmClearOpen(false);
    reloadData();
  };

  const hasHistory = completedTrades.length > 0;

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-xl backdrop-blur-md transition-all duration-300">
      {/* Header Tabs & Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800/80 mb-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-brand/10 text-brand border border-brand/20">
            <Trophy className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-xs font-semibold text-slate-300 tracking-wider uppercase">Trade Performance & History</h3>
            <p className="text-[11px] text-slate-400">Track record of executed trades, win rates, and exit metrics.</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {hasHistory && (
            <button
              onClick={() => setIsConfirmClearOpen(true)}
              className="px-2.5 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear Trade History</span>
            </button>
          )}

          <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800">
            <button
              onClick={() => setActiveTab('SUMMARY')}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                activeTab === 'SUMMARY'
                  ? 'bg-brand text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Analytics Summary
            </button>
            <button
              onClick={() => setActiveTab('HISTORY')}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                activeTab === 'HISTORY'
                  ? 'bg-brand text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Trade History ({completedTrades.length})
            </button>
          </div>
        </div>
      </div>

      {/* Analytics Summary View */}
      {activeTab === 'SUMMARY' && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {/* Total Trades */}
          <div className="bg-slate-950/60 border border-slate-800/80 p-3 rounded-lg">
            <span className="text-[10px] text-slate-400 block font-medium">Total Trades</span>
            <span className="text-xl font-bold text-slate-100">{summary.total_trades}</span>
            <span className="text-[10px] text-slate-400 block mt-0.5">
              Wins: <span className="text-emerald-400 font-semibold">{summary.winning_trades}</span> | Losses: <span className="text-rose-400 font-semibold">{summary.losing_trades}</span>
            </span>
          </div>

          {/* Win Rate % */}
          <div className="bg-slate-950/60 border border-slate-800/80 p-3 rounded-lg">
            <span className="text-[10px] text-slate-400 block font-medium">Win Rate</span>
            <span className="text-xl font-bold text-emerald-400">{hasHistory ? `${summary.win_rate_pct}%` : '--'}</span>
            <span className="text-[10px] text-slate-400 block mt-0.5">Target & Strategy</span>
          </div>

          {/* Average Gain */}
          <div className="bg-slate-950/60 border border-slate-800/80 p-3 rounded-lg">
            <span className="text-[10px] text-slate-400 block font-medium">Average Gain</span>
            <span className="text-base font-bold text-emerald-400">{hasHistory ? `+${summary.average_gain_pct}%` : '--'}</span>
            <span className="text-[10px] text-slate-400 block mt-0.5">Winning Trades</span>
          </div>

          {/* Average Loss */}
          <div className="bg-slate-950/60 border border-slate-800/80 p-3 rounded-lg">
            <span className="text-[10px] text-slate-400 block font-medium">Average Loss</span>
            <span className="text-base font-bold text-rose-400">{hasHistory ? `${summary.average_loss_pct}%` : '--'}</span>
            <span className="text-[10px] text-slate-400 block mt-0.5">Losing Trades</span>
          </div>

          {/* Largest Win / Loss */}
          <div className="bg-slate-950/60 border border-slate-800/80 p-3 rounded-lg">
            <span className="text-[10px] text-slate-400 block font-medium">Largest Win / Loss</span>
            <div className="text-xs font-bold text-slate-200 mt-0.5">
              {hasHistory ? (
                <>
                  <span className="text-emerald-400">+{summary.largest_win_pct}%</span> / <span className="text-rose-400">{summary.largest_loss_pct}%</span>
                </>
              ) : (
                '--'
              )}
            </div>
            <span className="text-[10px] text-slate-400 block mt-0.5">Best vs Worst</span>
          </div>

          {/* Avg Holding Duration */}
          <div className="bg-slate-950/60 border border-slate-800/80 p-3 rounded-lg">
            <span className="text-[10px] text-slate-400 block font-medium">Avg Holding Time</span>
            <span className="text-sm font-bold text-brand">{hasHistory ? summary.average_holding_time : '--'}</span>
            <span className="text-[10px] text-slate-400 block mt-0.5">Time in Market</span>
          </div>
        </div>
      )}

      {/* Trade History Table View */}
      {activeTab === 'HISTORY' && (
        <div>
          {!hasHistory ? (
            <div className="py-12 text-center bg-slate-950/40 rounded-xl border border-slate-800/60 flex flex-col items-center justify-center">
              <div className="p-3 rounded-full bg-slate-800/60 border border-slate-700/60 text-slate-400 mb-3 text-2xl">
                📈
              </div>
              <h4 className="text-sm font-bold text-slate-200">No completed trades yet</h4>
              <p className="text-xs text-slate-400 max-w-sm mt-1">
                Trades you track and complete will appear here with execution statistics and performance analytics.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-[11px] font-mono uppercase text-slate-400">
                    <th className="pb-2 pl-2">Ticker</th>
                    <th className="pb-2">Entry Price</th>
                    <th className="pb-2">Exit Price</th>
                    <th className="pb-2">Return %</th>
                    <th className="pb-2">Holding Time</th>
                    <th className="pb-2">Exit Reason</th>
                    <th className="pb-2">Date</th>
                    <th className="pb-2 pr-2 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-xs">
                  {completedTrades.map((t) => {
                    const isWin = t.profit_pct >= 0;
                    return (
                      <tr key={t.id} className="hover:bg-slate-950/40 transition-all group">
                        <td className="py-2.5 pl-2 font-bold text-slate-200">
                          <span className="px-2 py-0.5 rounded bg-brand/10 text-brand font-mono text-[11px]">
                            {t.ticker}
                          </span>
                        </td>
                        <td className="py-2.5 font-mono text-slate-300">₹{t.entry_price.toFixed(2)}</td>
                        <td className="py-2.5 font-mono text-slate-300">₹{t.exit_price ? t.exit_price.toFixed(2) : t.current_price.toFixed(2)}</td>
                        <td className={`py-2.5 font-mono font-bold ${isWin ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {isWin ? '+' : ''}{t.profit_pct}% (₹{t.profit_amount})
                        </td>
                        <td className="py-2.5 text-slate-400">{t.holding_time_mins} mins</td>
                        <td className="py-2.5 text-slate-300 truncate max-w-xs">{t.exit_reason || 'Closed'}</td>
                        <td className="py-2.5 text-slate-400 font-mono text-[10px]">
                          {new Date(t.exit_time || t.entry_time).toLocaleDateString('en-IN')}
                        </td>
                        <td className="py-2.5 pr-2 text-right">
                          <button
                            onClick={() => setTradeToDelete(t)}
                            title="Delete Trade"
                            className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Delete Single Trade Confirmation Modal */}
      {tradeToDelete && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 max-w-md w-full shadow-2xl">
            <h3 className="text-base font-bold text-slate-100 mb-2">Delete this trade?</h3>
            <p className="text-xs text-slate-400 mb-4">
              This action cannot be undone. Removing this trade will immediately recalculate all performance statistics.
            </p>
            <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 text-xs mb-5 space-y-1 font-mono">
              <div className="flex justify-between"><span className="text-slate-500">Ticker:</span> <span className="font-bold text-slate-200">{tradeToDelete.ticker}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Entry Price:</span> <span className="text-slate-300">₹{tradeToDelete.entry_price.toFixed(2)}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Exit Price:</span> <span className="text-slate-300">₹{tradeToDelete.exit_price?.toFixed(2) || tradeToDelete.current_price.toFixed(2)}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Profit:</span> <span className={tradeToDelete.profit_pct >= 0 ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>{tradeToDelete.profit_pct}%</span></div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setTradeToDelete(null)}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteSingle}
                className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-xs font-semibold text-white transition-colors cursor-pointer"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clear All Trade History Confirmation Modal */}
      {isConfirmClearOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 max-w-md w-full shadow-2xl">
            <h3 className="text-base font-bold text-slate-100 mb-2">Clear Trade History?</h3>
            <p className="text-xs text-slate-400 mb-5">
              This will permanently remove all completed trades and reset your trading statistics.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setIsConfirmClearOpen(false)}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleClearAll}
                className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-xs font-semibold text-white transition-colors cursor-pointer"
              >
                Delete Everything
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
