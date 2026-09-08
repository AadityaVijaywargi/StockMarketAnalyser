import React, { useState, useEffect } from 'react';
import { 
  Briefcase, TrendingUp, TrendingDown, DollarSign, Download, 
  Search, ShieldAlert, Award, ArrowUpRight, ArrowDownRight, 
  Trash2, X, RefreshCw, Layers, CheckCircle2, Clock, Activity, Zap
} from 'lucide-react';
import { tradeStorageService, TRADE_STORAGE_UPDATED_EVENT } from '../services/trade_storage_service';
import { TrackedTrade, TradePerformanceSummary } from '../types';

export const PortfolioPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'active' | 'closed'>('active');
  const [activeTrades, setActiveTrades] = useState<TrackedTrade[]>([]);
  const [completedTrades, setCompletedTrades] = useState<TrackedTrade[]>([]);
  const [summary, setSummary] = useState<TradePerformanceSummary>(tradeStorageService.getPerformanceSummary());
  const [searchQuery, setSearchQuery] = useState<string>('');

  const loadData = () => {
    setActiveTrades(tradeStorageService.getActiveTrades());
    setCompletedTrades(tradeStorageService.getCompletedTrades());
    setSummary(tradeStorageService.getPerformanceSummary());
  };

  useEffect(() => {
    loadData();

    const handleStorageUpdate = () => {
      loadData();
    };

    window.addEventListener(TRADE_STORAGE_UPDATED_EVENT, handleStorageUpdate);
    return () => {
      window.removeEventListener(TRADE_STORAGE_UPDATED_EVENT, handleStorageUpdate);
    };
  }, []);

  const handleManualClose = (tradeId: string) => {
    tradeStorageService.closeTrade(tradeId, undefined, 'Manual exit executed by user.', 'MANUAL_EXIT');
    loadData();
  };

  const handleDeleteTrade = (tradeId: string) => {
    tradeStorageService.deleteTrade(tradeId);
    loadData();
  };

  const handleExportCSV = () => {
    const csvContent = tradeStorageService.exportToCSV();
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `STONKS_Trade_Management_Report_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    // createObjectURL leaks memory until explicitly revoked - it was never
    // being released, so every export accumulated another live blob for
    // the rest of the page's lifetime.
    URL.revokeObjectURL(url);
  };

  const filterTrades = (list: TrackedTrade[]) => {
    if (!searchQuery) return list;
    const q = searchQuery.toUpperCase().trim();
    return list.filter(t => t.ticker.toUpperCase().includes(q) || t.company_name.toUpperCase().includes(q));
  };

  const displayedActive = filterTrades(activeTrades);
  const displayedClosed = filterTrades(completedTrades);

  return (
    <div className="min-h-screen bg-background text-text font-sans p-6 md:p-8 flex flex-col gap-6 max-w-7xl mx-auto">
      
      {/* Workspace Header & Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-borderDark/80 pb-5">
        <div>
          <h1 className="font-extrabold text-2xl text-white tracking-tight flex items-center gap-2.5 font-mono">
            <Briefcase className="w-6 h-6 text-brand" />
            <span>Trade Management & Portfolio</span>
            <span className="text-xs bg-brand/15 border border-brand/30 text-brand px-2.5 py-0.5 rounded-full font-bold">
              PHASE 30 LIVE
            </span>
          </h1>
          <p className="text-xs text-textMuted mt-1">Real-time Trade Management System with Automated Exit Rules & AI Analytics</p>
        </div>

        {/* CSV Export & Actions */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-4 py-2 bg-brand/15 border border-brand/40 text-brand rounded-xl text-xs font-mono font-bold hover:bg-brand/25 transition-all shadow-md"
          >
            <Download className="w-4 h-4" />
            <span>Export to CSV</span>
          </button>
        </div>
      </div>

      {/* Metric Header Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        
        {/* Card 1: Total Realized P/L */}
        <div className="bg-surface border border-borderDark p-4 rounded-2xl flex flex-col gap-1.5 shadow-lg">
          <span className="text-xs text-textMuted font-mono font-semibold">Total Realized P/L</span>
          <div className={`font-mono text-xl font-extrabold ${
            summary.total_realized_pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'
          }`}>
            {summary.total_realized_pnl >= 0 ? '+' : ''}₹{summary.total_realized_pnl.toLocaleString('en-IN')}
          </div>
          <span className="text-[11px] text-textMuted font-mono">From {summary.closed_trades} completed trades</span>
        </div>

        {/* Card 2: Win Rate */}
        <div className="bg-surface border border-borderDark p-4 rounded-2xl flex flex-col gap-1.5 shadow-lg">
          <span className="text-xs text-textMuted font-mono font-semibold">Win Rate</span>
          <div className="font-mono text-xl font-extrabold text-white flex items-center gap-2">
            <span>{summary.win_rate_pct}%</span>
            <span className="text-xs font-normal text-emerald-400">({summary.winning_trades}W / {summary.losing_trades}L)</span>
          </div>
          <span className="text-[11px] text-textMuted font-mono">Completed Trades</span>
        </div>

        {/* Card 3: Avg Gain vs Avg Loss */}
        <div className="bg-surface border border-borderDark p-4 rounded-2xl flex flex-col gap-1.5 shadow-lg">
          <span className="text-xs text-textMuted font-mono font-semibold">Avg Gain / Avg Loss</span>
          <div className="font-mono text-base font-extrabold flex items-center gap-2">
            <span className="text-emerald-400">+{summary.average_gain_pct}%</span>
            <span className="text-textMuted font-normal">/</span>
            <span className="text-rose-400">-{Math.abs(summary.average_loss_pct)}%</span>
          </div>
          <span className="text-[11px] text-textMuted font-mono">Per closed position</span>
        </div>

        {/* Card 4: Portfolio Risk/Reward */}
        <div className="bg-surface border border-borderDark p-4 rounded-2xl flex flex-col gap-1.5 shadow-lg">
          <span className="text-xs text-textMuted font-mono font-semibold">Portfolio Risk / Reward</span>
          <div className="font-mono text-xl font-extrabold text-brand">
            1 : {summary.risk_reward_ratio}
          </div>
          <span className="text-[11px] text-textMuted font-mono">Average R:R Ratio</span>
        </div>

        {/* Card 5: AI Accuracy */}
        <div className="bg-surface border border-borderDark p-4 rounded-2xl flex flex-col gap-1.5 shadow-lg">
          <span className="text-xs text-textMuted font-mono font-semibold">AI Recommendation Accuracy</span>
          <div className="font-mono text-xl font-extrabold text-purple-400 flex items-center gap-1.5">
            <Award className="w-5 h-5 text-purple-400" />
            <span>{summary.ai_accuracy_pct}%</span>
          </div>
          <span className="text-[11px] text-textMuted font-mono">Deterministic Signals</span>
        </div>

      </div>

      {/* Tabs & Search Filter Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-surface border border-borderDark p-3 rounded-2xl shadow-md font-mono text-xs">
        {/* Navigation Tabs */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('active')}
            className={`px-4 py-2 rounded-xl font-bold transition-all flex items-center gap-2 ${
              activeTab === 'active'
                ? 'bg-brand text-white shadow-md shadow-brand/20'
                : 'text-textMuted hover:text-white hover:bg-white/[0.04]'
            }`}
          >
            <Activity className="w-4 h-4" />
            <span>Active Positions ({activeTrades.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('closed')}
            className={`px-4 py-2 rounded-xl font-bold transition-all flex items-center gap-2 ${
              activeTab === 'closed'
                ? 'bg-brand text-white shadow-md shadow-brand/20'
                : 'text-textMuted hover:text-white hover:bg-white/[0.04]'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Trade History Log ({completedTrades.length})</span>
          </button>
        </div>

        {/* Search Input Filter */}
        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-textMuted" />
          <input
            type="text"
            placeholder="Search ticker or company..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-background border border-borderDark rounded-xl pl-9 pr-3 py-1.5 text-white font-sans text-xs focus:border-brand outline-none"
          />
        </div>
      </div>

      {/* ACTIVE POSITIONS TAB CONTENT */}
      {activeTab === 'active' && (
        <div className="flex flex-col gap-4">
          {displayedActive.length === 0 ? (
            <div className="bg-surface border border-borderDark/80 p-12 rounded-2xl text-center text-textMuted flex flex-col items-center gap-3">
              <Briefcase className="w-10 h-10 text-borderDark" />
              <p className="font-mono text-sm font-semibold">No active trade positions found.</p>
              <p className="text-xs">Select a stock on the Dashboard and click "Track Trade" to open a position.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {displayedActive.map(trade => (
                <div 
                  key={trade.id} 
                  className="bg-surface border border-borderDark hover:border-brand/40 p-5 rounded-2xl transition-all shadow-lg flex flex-col gap-4"
                >
                  {/* Top Bar */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-borderDark/60 pb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-brand/15 border border-brand/30 flex items-center justify-center font-mono font-bold text-brand">
                        {trade.ticker.slice(0, 2)}
                      </div>
                      <div>
                        <h4 className="font-bold text-base text-white font-mono flex items-center gap-2">
                          <span>{trade.ticker}</span>
                          <span className="text-xs text-textMuted font-sans">({trade.quantity} Shares)</span>
                        </h4>
                        <p className="text-xs text-textMuted">{trade.company_name}</p>
                      </div>
                    </div>

                    {/* Live P/L Badge */}
                    <div className="flex items-center gap-3">
                      <div className={`flex flex-col items-end px-3 py-1.5 rounded-xl border font-mono ${
                        trade.profit_amount >= 0 
                          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                          : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                      }`}>
                        <span className="text-xs text-textMuted font-sans">Live P/L</span>
                        <span className="font-extrabold text-sm">
                          {trade.profit_amount >= 0 ? '+' : ''}₹{trade.profit_amount.toLocaleString('en-IN')} ({trade.profit_pct >= 0 ? '+' : ''}{trade.profit_pct}%)
                        </span>
                      </div>

                      <button
                        onClick={() => handleManualClose(trade.id)}
                        className="px-3 py-1.5 bg-rose-500/15 border border-rose-500/40 text-rose-400 rounded-xl text-xs font-mono font-bold hover:bg-rose-500/25 transition-all"
                      >
                        Close Position
                      </button>
                    </div>
                  </div>

                  {/* Details Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-6 gap-3 text-xs font-mono bg-background/60 p-3 rounded-xl border border-borderDark/60">
                    <div>
                      <span className="text-textMuted text-[10px]">Entry Price:</span>
                      <div className="text-white font-bold">₹{trade.entry_price}</div>
                    </div>

                    <div>
                      <span className="text-textMuted text-[10px]">Current Price:</span>
                      <div className="text-brand font-bold">₹{trade.current_price}</div>
                    </div>

                    <div>
                      <span className="text-textMuted text-[10px]">Profit Target:</span>
                      <div className="text-emerald-400 font-bold">₹{trade.target_price} ({trade.distance_to_target_pct}% away)</div>
                    </div>

                    <div>
                      <span className="text-textMuted text-[10px]">Stop Loss:</span>
                      <div className="text-rose-400 font-bold">₹{trade.initial_stop_loss} ({trade.distance_to_stop_pct}% away)</div>
                    </div>

                    <div>
                      <span className="text-textMuted text-[10px]">Risk / Reward:</span>
                      <div className="text-amber-400 font-bold">1 : {trade.risk_reward_ratio}</div>
                    </div>

                    <div>
                      <span className="text-textMuted text-[10px]">AI Confidence:</span>
                      <div className="text-purple-400 font-bold">{trade.ai_confidence_at_entry || trade.initial_confidence}%</div>
                    </div>
                  </div>

                  {/* Notes & Status Footer */}
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono text-textMuted">
                    {trade.trade_notes && (
                      <span className="text-slate-300 italic font-sans">"Notes: {trade.trade_notes}"</span>
                    )}
                    <span className="text-[11px]">Opened {new Date(trade.entry_time).toLocaleString('en-IN')}</span>
                  </div>

                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* CLOSED TRADES HISTORY TAB CONTENT */}
      {activeTab === 'closed' && (
        <div className="bg-surface border border-borderDark rounded-2xl overflow-hidden shadow-xl">
          {displayedClosed.length === 0 ? (
            <div className="p-12 text-center text-textMuted font-mono text-sm">
              No completed trade history available.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse font-mono text-xs">
                <thead>
                  <tr className="bg-background border-b border-borderDark text-textMuted uppercase text-[10px]">
                    <th className="p-3.5">Ticker & Company</th>
                    <th className="p-3.5">Qty</th>
                    <th className="p-3.5">Entry Price</th>
                    <th className="p-3.5">Exit Price</th>
                    <th className="p-3.5">Realized P/L</th>
                    <th className="p-3.5">Exit Reason</th>
                    <th className="p-3.5">Duration</th>
                    <th className="p-3.5">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-borderDark/60">
                  {displayedClosed.map(trade => (
                    <tr key={trade.id} className="hover:bg-white/[0.02] transition-all">
                      <td className="p-3.5">
                        <div className="font-bold text-white">{trade.ticker}</div>
                        <div className="text-[10px] text-textMuted font-sans">{trade.company_name}</div>
                      </td>
                      <td className="p-3.5 text-slate-300">{trade.quantity}</td>
                      <td className="p-3.5 text-slate-300">₹{trade.entry_price}</td>
                      <td className="p-3.5 text-slate-300">₹{trade.exit_price || trade.current_price}</td>
                      <td className="p-3.5 font-bold">
                        <span className={trade.profit_amount >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                          {trade.profit_amount >= 0 ? '+' : ''}₹{trade.profit_amount} ({trade.profit_pct >= 0 ? '+' : ''}{trade.profit_pct}%)
                        </span>
                      </td>
                      <td className="p-3.5 text-slate-300 font-sans max-w-xs truncate" title={trade.exit_reason}>
                        {trade.exit_reason}
                      </td>
                      <td className="p-3.5 text-textMuted">{trade.holding_time_mins} mins</td>
                      <td className="p-3.5">
                        <button
                          onClick={() => handleDeleteTrade(trade.id)}
                          className="text-textMuted hover:text-rose-400 transition-all p-1"
                          title="Delete trade log"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

    </div>
  );
};
