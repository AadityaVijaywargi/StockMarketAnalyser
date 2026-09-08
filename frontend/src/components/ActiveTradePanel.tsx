import React, { useState, useEffect } from 'react';
import { TrackedTrade } from '../types';
import { tradeStorageService, TRADE_STORAGE_UPDATED_EVENT } from '../services/trade_storage_service';
import { 
  TrendingUp, 
  TrendingDown, 
  Clock, 
  ShieldAlert, 
  Target, 
  ChevronDown, 
  ChevronUp, 
  XCircle,
  Activity,
  Lock
} from 'lucide-react';

interface ActiveTradePanelProps {
  ticker?: string;
  latestPrice?: number;
}

export const ActiveTradePanel: React.FC<ActiveTradePanelProps> = ({ ticker, latestPrice }) => {
  const [activeTrades, setActiveTrades] = useState<TrackedTrade[]>([]);
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);

  const reloadTrades = () => {
    const trades = tradeStorageService.getActiveTrades();
    if (ticker) {
      const clean = ticker.toUpperCase().trim();
      // Filter or prioritize current ticker trade first
      const current = trades.filter(t => t.ticker.toUpperCase().trim() === clean);
      const others = trades.filter(t => t.ticker.toUpperCase().trim() !== clean);
      setActiveTrades([...current, ...others]);
    } else {
      setActiveTrades(trades);
    }
  };

  useEffect(() => {
    reloadTrades();
    const handleUpdate = () => reloadTrades();
    window.addEventListener(TRADE_STORAGE_UPDATED_EVENT, handleUpdate);
    return () => window.removeEventListener(TRADE_STORAGE_UPDATED_EVENT, handleUpdate);
  }, [ticker]);

  // Update live price for active trades if latestPrice passed
  useEffect(() => {
    if (latestPrice && activeTrades.length > 0) {
      activeTrades.forEach(trade => {
        if (ticker && trade.ticker.toUpperCase().trim() === ticker.toUpperCase().trim()) {
          tradeStorageService.updateTradePrice(trade.id, latestPrice);
        }
      });
    }
  }, [latestPrice, ticker]);

  if (activeTrades.length === 0) return null;

  const handleCloseTrade = (tradeId: string) => {
    tradeStorageService.closeTrade(tradeId, latestPrice, 'Manual trade closure executed.');
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-xl backdrop-blur-md transition-all duration-300">
      {/* Header Bar */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <Activity className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h3 className="text-xs font-semibold text-slate-300 tracking-wider uppercase flex items-center gap-2">
              <span>Active Trade Management</span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-bold border border-emerald-500/30">
                {activeTrades.length} Active
              </span>
            </h3>
            <p className="text-[11px] text-slate-400">Monitoring targets, trailing stop losses, and live risk parameters.</p>
          </div>
        </div>

        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-all cursor-pointer"
          title={isCollapsed ? "Expand Panel" : "Collapse Panel"}
        >
          {isCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
        </button>
      </div>

      {/* Trade Cards Grid */}
      {!isCollapsed && (
        <div className="mt-4 space-y-4">
          {activeTrades.map((trade) => {
            const isProfitable = trade.profit_pct >= 0;
            const distanceToStopPct = trade.current_price > 0 
              ? Number((((trade.current_price - trade.trailing_stop_loss) / trade.current_price) * 100).toFixed(2)) 
              : 0;

            const isBreakevenLocked = trade.trailing_stop_loss >= trade.entry_price;

            return (
              <div 
                key={trade.id} 
                className={`p-4 rounded-xl border transition-all ${
                  isProfitable 
                    ? 'bg-slate-950/70 border-emerald-500/30' 
                    : 'bg-slate-950/70 border-rose-500/30'
                }`}
              >
                {/* Top Row: Ticker, Tracker Type Badge & Close Action */}
                <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-800/60">
                  <div className="flex items-center gap-2.5">
                    <span className="px-2.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-mono text-xs font-bold border border-indigo-500/30">
                      {trade.ticker}
                    </span>
                    <span className="text-sm font-semibold text-slate-200">{trade.company_name}</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono border ${
                      trade.tracker_type === 'SELL'
                        ? 'bg-brand/20 text-indigo-300 border-brand/40'
                        : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                    }`}>
                      {trade.tracker_type === 'SELL' ? 'SELL TRACKER' : 'BUY TRACKER'}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono ml-1">[{trade.timeframe}]</span>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className={`px-3 py-1 rounded-full text-xs font-bold border ${
                      trade.exit_recommendation === 'TAKE PROFIT' || trade.exit_recommendation === 'PARTIAL SELL'
                        ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 animate-pulse'
                        : trade.exit_recommendation === 'STOP LOSS HIT' || trade.exit_recommendation === 'EXIT NOW'
                        ? 'bg-rose-500/20 text-rose-400 border-rose-500/40 animate-pulse'
                        : 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30'
                    }`}>
                      {trade.exit_recommendation}
                    </div>

                    <button
                      onClick={() => handleCloseTrade(trade.id)}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-400 text-xs font-semibold border border-rose-500/30 transition-all cursor-pointer"
                      title="Close position"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      <span>Close Trade</span>
                    </button>
                  </div>
                </div>

                {/* Status Warning Banner if Stop Loss or Target Hit */}
                {trade.status === 'STOP_LOSS_HIT' && (
                  <div className="mb-3 p-2.5 rounded-lg bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs font-semibold flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-rose-400 flex-shrink-0" />
                    <span>STOP LOSS HIT: Risk threshold reached. Consider exiting position immediately.</span>
                  </div>
                )}

                {(trade.status === 'TARGET_REACHED' || (trade.status as string) === 'TARGET_HIT') && (
                  <div className="mb-3 p-2.5 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-semibold flex items-center gap-2">
                    <Target className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    <span>TARGET REACHED: Projected exit price or resistance achieved. Consider locking in gains.</span>
                  </div>
                )}

                {/* Metrics Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                  {/* Entry Price / Avg Buy Price */}
                  <div className="bg-slate-900/60 p-2.5 rounded-lg border border-slate-800/80">
                    <span className="text-[10px] text-slate-400 block font-medium">
                      {trade.tracker_type === 'SELL' ? 'Avg Buy Price' : 'Entry Price'}
                    </span>
                    <span className="text-sm font-bold text-slate-200 font-mono">
                      ₹{(trade.avg_buy_price || trade.entry_price).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                    {trade.tracker_type === 'SELL' && trade.quantity && (
                      <span className="text-[10px] text-slate-400 block mt-0.5 font-mono">
                        Qty: {trade.quantity} shares
                      </span>
                    )}
                  </div>

                  {/* Current Price */}
                  <div className="bg-slate-900/60 p-2.5 rounded-lg border border-slate-800/80">
                    <span className="text-[10px] text-slate-400 block font-medium">Current Price</span>
                    <span className="text-sm font-bold text-slate-100 font-mono">
                      ₹{trade.current_price.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>

                  {/* Live Profit / Loss & Total Return */}
                  <div className={`p-2.5 rounded-lg border ${
                    isProfitable 
                      ? 'bg-emerald-500/10 border-emerald-500/30' 
                      : 'bg-rose-500/10 border-rose-500/30'
                  }`}>
                    <span className="text-[10px] text-slate-400 block font-medium">
                      {trade.tracker_type === 'SELL' ? 'Total P&L' : 'Live P&L'}
                    </span>
                    <div className={`text-sm font-bold font-mono flex items-center gap-1 ${
                      isProfitable ? 'text-emerald-400' : 'text-rose-400'
                    }`}>
                      {isProfitable ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                      <span>{isProfitable ? '+' : ''}{trade.profit_pct}%</span>
                      <span className="text-[10px] text-slate-400 font-normal">
                        ({isProfitable ? '+₹' : '-₹'}{Math.abs(trade.tracker_type === 'SELL' ? (trade.current_price - (trade.avg_buy_price || trade.entry_price)) * (trade.quantity || 1) : trade.profit_amount).toFixed(2)})
                      </span>
                    </div>
                  </div>

                  {/* Target & Progress */}
                  <div className="bg-slate-900/60 p-2.5 rounded-lg border border-slate-800/80">
                    <div className="flex items-center justify-between text-[10px] text-slate-400 mb-0.5">
                      <span>{trade.tracker_type === 'SELL' ? 'Resistance' : 'Target'} (₹{trade.target_price})</span>
                      <span className="font-bold text-emerald-400">{trade.target_progress_pct}%</span>
                    </div>
                    <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden mt-1">
                      <div 
                        className="bg-emerald-500 h-full rounded-full transition-all duration-500" 
                        style={{ width: `${trade.target_progress_pct}%` }} 
                      />
                    </div>
                  </div>

                  {/* Trailing Stop Loss */}
                  <div className="bg-slate-900/60 p-2.5 rounded-lg border border-slate-800/80">
                    <div className="flex items-center justify-between text-[10px] text-slate-400">
                      <span>Trailing Stop</span>
                      {isBreakevenLocked && <Lock className="w-3 h-3 text-indigo-400" />}
                    </div>
                    <span className="text-sm font-bold text-slate-200 font-mono block mt-0.5">
                      ₹{trade.trailing_stop_loss.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                    <span className="text-[10px] text-slate-400 block">
                      Dist: <span className="text-amber-400 font-semibold">{distanceToStopPct}%</span>
                    </span>
                  </div>

                  {/* Holding Time */}
                  <div className="bg-slate-900/60 p-2.5 rounded-lg border border-slate-800/80">
                    <div className="flex items-center justify-between text-[10px] text-slate-400">
                      <span>Tracking Duration</span>
                      <Clock className="w-3 h-3 text-slate-400" />
                    </div>
                    <span className="text-xs font-bold text-slate-300 block mt-1">
                      {trade.holding_time_mins} mins
                    </span>
                    <span className="text-[10px] text-slate-400 block">
                      Peak: <span className="text-emerald-400">+{trade.highest_profit_pct}%</span>
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
