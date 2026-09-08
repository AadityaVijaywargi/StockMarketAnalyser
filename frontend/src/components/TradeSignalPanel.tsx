import React, { useState, useEffect } from 'react';
import { TradeSignal, PredictionResult } from '../types';
import { apiService } from '../services/api';
import { 
  TrendingUp, 
  TrendingDown, 
  Clock, 
  ShieldAlert, 
  Target, 
  CheckCircle2, 
  AlertTriangle,
  RefreshCw,
  Zap,
  Play,
  UserCheck
} from 'lucide-react';
import { tradeStorageService, TRADE_STORAGE_UPDATED_EVENT } from '../services/trade_storage_service';

interface TradeSignalPanelProps {
  initialSignal?: TradeSignal;
  prediction?: PredictionResult | null;
  ticker: string;
  activeTimeframe: string;
  onTimeframeChange?: (tf: string) => void;
  companyName?: string;
}

export const TradeSignalPanel: React.FC<TradeSignalPanelProps> = ({
  initialSignal,
  prediction,
  ticker,
  activeTimeframe,
  onTimeframeChange,
  companyName = ''
}) => {
  const [signal, setSignal] = useState<TradeSignal | undefined>(initialSignal);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isBuyTracked, setIsBuyTracked] = useState<boolean>(false);
  const [isSellTracked, setIsSellTracked] = useState<boolean>(false);
  const [showSellModal, setShowSellModal] = useState<boolean>(false);
  const [sellAvgPrice, setSellAvgPrice] = useState<number>(0);
  const [sellQty, setSellQty] = useState<number>(10);

  const [positionStatus, setPositionStatus] = useState<'NO_POSITION' | 'HOLDING_LONG' | 'HOLDING_SHORT'>('NO_POSITION');

  // Check if current trade is tracked
  const checkTrackingState = () => {
    if (!ticker) return;
    const active = tradeStorageService.getActiveTrades();
    const clean = ticker.toUpperCase().trim();
    const buyMatch = active.some(t => t.ticker.toUpperCase().trim() === clean && (t.tracker_type || 'BUY') === 'BUY');
    const sellMatch = active.some(t => t.ticker.toUpperCase().trim() === clean && t.tracker_type === 'SELL');
    setIsBuyTracked(buyMatch);
    setIsSellTracked(sellMatch);
  };

  useEffect(() => {
    checkTrackingState();
    const handleUpdate = () => checkTrackingState();
    window.addEventListener(TRADE_STORAGE_UPDATED_EVENT, handleUpdate);
    return () => window.removeEventListener(TRADE_STORAGE_UPDATED_EVENT, handleUpdate);
  }, [ticker]);

  const handleStartBuyTracker = () => {
    if (!signal || !ticker) return;
    tradeStorageService.startBuyTracker({
      ticker,
      company_name: companyName || ticker,
      entry_price: signal.current_price,
      timeframe: activeTimeframe,
      target_price: signal.target_price || Number((signal.current_price * 1.05).toFixed(2)),
      stop_loss: signal.stop_loss_price || Number((signal.current_price * 0.95).toFixed(2)),
      confidence: signal.confidence,
      signal: signal.signal
    });
    setIsBuyTracked(true);
  };

  const handleOpenSellModal = () => {
    if (!signal) return;
    setSellAvgPrice(signal.current_price);
    setShowSellModal(true);
  };

  const handleConfirmSellTracker = () => {
    if (!signal || !ticker) return;
    tradeStorageService.startSellTracker({
      ticker,
      company_name: companyName || ticker,
      current_price: signal.current_price,
      avg_buy_price: sellAvgPrice || signal.current_price,
      quantity: sellQty || 1,
      timeframe: activeTimeframe,
      trailing_stop: signal.trailing_stop_price || Number((signal.current_price * 0.97).toFixed(2)),
      target_price: signal.next_resistance_target || Number((signal.current_price * 1.05).toFixed(2)),
      confidence: signal.confidence,
      signal: signal.signal
    });
    setIsSellTracked(true);
    setShowSellModal(false);
  };

  // Sync initial signal when report changes
  useEffect(() => {
    if (initialSignal) {
      setSignal(initialSignal);
    }
  }, [initialSignal]);

  // Recalculate signal dynamically when timeframe option or position status changes
  useEffect(() => {
    let isMounted = true;
    const fetchSignal = async () => {
      if (!ticker) return;
      setLoading(true);
      setError(null);
      try {
        const data = await apiService.getTradeSignal(ticker, activeTimeframe, positionStatus);
        if (isMounted) {
          setSignal(data);
        }
      } catch (err: any) {
        if (isMounted) {
          console.error('Failed to fetch trade signal', err);
          setError('Failed to calculate real-time trade signal for this timeframe.');
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchSignal();
    return () => {
      isMounted = false;
    };
  }, [ticker, activeTimeframe, positionStatus]);

  if (!signal && !loading && !error) return null;

  const currentSignal: string = signal?.signal || 'WAIT';
  const lifecycle = signal?.lifecycle_status || 'ENTRY_VALID';
  const isHolding = positionStatus === 'HOLDING_LONG';
  const isExitSignal = currentSignal === 'SELL NOW' || currentSignal === 'AVOID' || currentSignal === 'SELL';

  // Badge Styling
  const getSignalBadgeStyle = () => {
    switch (currentSignal) {
      case 'BUY NOW':
        return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 shadow-emerald-900/20';
      case 'HOLD':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/40 shadow-blue-900/20';
      case 'PARTIAL SELL':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-amber-900/20';
      case 'SELL NOW':
        return 'bg-rose-500/20 text-rose-400 border-rose-500/40 shadow-rose-900/20';
      case 'WAIT':
        return 'bg-amber-500/20 text-amber-400 border-amber-500/40 shadow-amber-900/20';
      case 'AVOID':
      default:
        return 'bg-slate-500/20 text-slate-400 border-slate-500/40 shadow-slate-900/20';
    }
  };

  const getSignalDot = () => {
    switch (currentSignal) {
      case 'BUY NOW':
        return <span className="relative flex h-3 w-3"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span><span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span></span>;
      case 'HOLD':
        return <span className="relative flex h-3 w-3"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span><span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500"></span></span>;
      case 'PARTIAL SELL':
        return <span className="h-3 w-3 rounded-full bg-amber-300"></span>;
      case 'SELL NOW':
        return <span className="relative flex h-3 w-3"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span><span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500"></span></span>;
      case 'WAIT':
        return <span className="h-3 w-3 rounded-full bg-amber-400"></span>;
      case 'AVOID':
      default:
        return <span className="h-3 w-3 rounded-full bg-slate-400"></span>;
    }
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-xl backdrop-blur-md transition-all duration-300 relative overflow-hidden">
      {/* Sell Configuration Modal */}
      {showSellModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-5 max-w-md w-full shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider mb-1 flex items-center gap-2">
              <Play className="w-4 h-4 text-brand fill-brand" />
              Configure Sell Tracker Position
            </h3>
            <p className="text-xs text-slate-400 mb-4 leading-relaxed">
              Enter your purchase details for <span className="text-slate-200 font-bold">{companyName || ticker}</span> to monitor unrealized P&L, exit triggers, and trailing stops.
            </p>

            <div className="space-y-3 mb-5">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Average Buy Price (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  value={sellAvgPrice}
                  onChange={(e) => setSellAvgPrice(parseFloat(e.target.value) || 0)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm font-bold text-emerald-400 focus:outline-none focus:border-brand"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Quantity Owned (Optional)</label>
                <input
                  type="number"
                  step="1"
                  value={sellQty}
                  onChange={(e) => setSellQty(parseInt(e.target.value) || 1)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm font-bold text-slate-200 focus:outline-none focus:border-brand"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setShowSellModal(false)}
                className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmSellTracker}
                className="px-4 py-1.5 rounded-lg bg-brand hover:bg-indigo-600 text-white text-xs font-bold shadow-md shadow-brand/30 transition-all cursor-pointer"
              >
                Start Tracking Sell
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Background Glow Overlay */}
      <div 
        className={`absolute top-0 right-0 w-72 h-72 rounded-full blur-3xl pointer-events-none opacity-10 ${
          currentSignal === 'BUY NOW' ? 'bg-emerald-500' : currentSignal === 'HOLD' ? 'bg-blue-500' : currentSignal === 'SELL NOW' ? 'bg-rose-500' : 'bg-amber-500'
        }`}
      />

      {/* Position Status Selector Bar */}
      <div className="mb-4 bg-slate-950/80 border border-slate-800/90 rounded-lg p-2.5 flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
          <span className="text-xs font-bold text-slate-200 tracking-wide">Position Context:</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setPositionStatus('NO_POSITION')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              positionStatus === 'NO_POSITION'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-950/50 border border-indigo-400/40'
                : 'bg-slate-800/80 text-slate-400 hover:text-slate-200 hover:bg-slate-750'
            }`}
          >
            I do not own this stock
          </button>

          <button
            onClick={() => setPositionStatus('HOLDING_LONG')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              positionStatus === 'HOLDING_LONG'
                ? 'bg-brand text-white shadow-md shadow-brand/40 border border-brand/40'
                : 'bg-slate-800/80 text-slate-400 hover:text-slate-200 hover:bg-slate-750'
            }`}
          >
            I currently own this stock
          </button>

          <button
            disabled
            className="px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-800/40 text-slate-600 border border-slate-800 cursor-not-allowed opacity-60"
            title="Short position mode available in future release"
          >
            Short Position (Soon)
          </button>
        </div>
      </div>

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-800/80">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <Zap className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-xs font-semibold text-slate-400 tracking-wider uppercase">
              {isHolding ? 'Position Holder Exit Analysis' : 'Pre-Entry Trade Assistant'}
            </h3>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs text-slate-400 font-medium">Analysis Horizon: <span className="text-indigo-400 font-bold">{activeTimeframe}</span></span>
              {loading && <RefreshCw className="w-3 h-3 text-indigo-400 animate-spin" />}
            </div>
          </div>
        </div>

        {/* Signal Badge & Dual Tracker Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Buy Tracker Button */}
          {isBuyTracked ? (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
              <CheckCircle2 className="w-4 h-4" />
              <span>Buy Tracked</span>
            </div>
          ) : (
            <button
              onClick={handleStartBuyTracker}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-xs shadow-md shadow-emerald-950/40 transition-all transform active:scale-95 cursor-pointer"
            >
              <Play className="w-3.5 h-3.5 fill-slate-950" />
              <span>+ Start Buy Tracker</span>
            </button>
          )}

          {/* Sell Tracker Button */}
          {isSellTracked ? (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand/15 border border-brand/40 text-brand text-xs font-semibold">
              <CheckCircle2 className="w-4 h-4" />
              <span>Sell Tracked</span>
            </div>
          ) : (
            <button
              onClick={handleOpenSellModal}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand hover:bg-indigo-600 text-white font-bold text-xs shadow-md shadow-brand/30 transition-all transform active:scale-95 cursor-pointer"
            >
              <Play className="w-3.5 h-3.5 fill-white" />
              <span>+ Start Sell Tracker</span>
            </button>
          )}

          <div className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full border font-bold text-sm tracking-wide shadow-lg ${getSignalBadgeStyle()}`}>
            {getSignalDot()}
            <span>{currentSignal}</span>
          </div>

          {signal?.confidence && (
            <div className="px-3 py-1 rounded-full bg-slate-800 border border-slate-700 text-xs font-semibold text-slate-300">
              {signal.confidence}% Confidence
            </div>
          )}
        </div>
      </div>

      {/* Mode 2: Position Holder Grid (SELL NOW / HOLD / PARTIAL SELL) */}
      {isHolding ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
          {/* Box 1: Exit Reference Price */}
          <div className="bg-slate-950/60 border border-slate-800/80 rounded-lg p-3">
            <span className="text-xs text-slate-400 font-medium block mb-1">Exit Reference Price</span>
            <div className="text-lg font-bold text-slate-100">
              ₹{signal?.current_price ? signal.current_price.toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '—'}
            </div>
            <span className="text-[10px] text-slate-400 mt-1 block">Live Market Reference</span>
          </div>

          {/* Box 2: Next Resistance Target */}
          <div className="bg-slate-950/60 border border-slate-800/80 rounded-lg p-3">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
              <span>Next Resistance</span>
              <Target className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <div className="text-lg font-bold text-emerald-400">
              ₹{signal?.next_resistance_target ? signal.next_resistance_target.toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '—'}
            </div>
            <span className="text-[10px] text-emerald-400 font-semibold block mt-0.5">
              +{signal?.remaining_upside_pct || 0}% Upside Potential
            </span>
          </div>

          {/* Box 3: Suggested Trailing Stop */}
          <div className="bg-slate-950/60 border border-slate-800/80 rounded-lg p-3">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
              <span>Trailing Stop</span>
              <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
            </div>
            <div className="text-lg font-bold text-rose-400">
              ₹{signal?.trailing_stop_price ? signal.trailing_stop_price.toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '—'}
            </div>
            <span className="text-[10px] text-rose-400 font-semibold block mt-0.5">
              -{signal?.downside_risk_pct || 0}% Downside Protection
            </span>
          </div>

          {/* Box 4: Rally Probability */}
          <div className="bg-slate-950/60 border border-slate-800/80 rounded-lg p-3">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
              <span>Rally Probability</span>
              <TrendingUp className="w-3.5 h-3.5 text-indigo-400" />
            </div>
            <div className="text-lg font-bold text-indigo-300">
              {signal?.rally_probability || 75}%
            </div>
            <span className="text-[10px] text-slate-400 block mt-0.5">
              Momentum Score
            </span>
          </div>
        </div>
      ) : (
        /* Mode 1: Pre-Entry Grid (BUY / WAIT / AVOID) */
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            {/* Current Price */}
            <div className="bg-slate-950/60 border border-slate-800/80 rounded-lg p-3.5 flex flex-col justify-between">
              <span className="text-xs text-slate-400 font-medium">Current Price</span>
              <div className="text-2xl font-bold text-slate-100 mt-1">
                ₹{signal?.current_price ? signal.current_price.toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '—'}
              </div>
              <span className="text-[10px] text-slate-400 mt-1">Live Market Reference</span>
            </div>

            {/* Entry Zone */}
            <div className="bg-slate-950/60 border border-slate-800/80 rounded-lg p-3.5 flex flex-col justify-between">
              <span className="text-xs text-slate-400 font-medium">Optimal Entry Zone</span>
              <div className="text-xl font-bold text-emerald-400 mt-1">
                ₹{signal?.entry_zone_low ? signal.entry_zone_low.toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '—'} 
                <span className="text-slate-500 text-sm font-normal mx-1 font-sans">–</span> 
                ₹{signal?.entry_zone_high ? signal.entry_zone_high.toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '—'}
              </div>
              <span className="text-[10px] text-slate-400 mt-1">ATR & Support Aligned</span>
            </div>
          </div>

          {/* Pre-Entry Key Metrics 4-Box Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
            <div className="bg-slate-950/40 border border-slate-800/60 rounded-lg p-3">
              <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                <span>Suggested Target</span>
                <Target className="w-3.5 h-3.5 text-emerald-400" />
              </div>
              <div className="text-base font-bold text-slate-100">
                {signal?.target_price ? `₹${signal.target_price.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—'}
              </div>
              <div className="text-xs font-semibold text-emerald-400 mt-0.5 flex items-center gap-1">
                <TrendingUp className="w-3 h-3" />
                <span>+{signal?.potential_return_pct || 0}% Return</span>
              </div>
            </div>

            <div className="bg-slate-950/40 border border-slate-800/60 rounded-lg p-3">
              <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                <span>Stop Loss</span>
                <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
              </div>
              <div className="text-base font-bold text-slate-100">
                {signal?.stop_loss_price ? `₹${signal.stop_loss_price.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—'}
              </div>
              <div className="text-xs font-semibold text-rose-400 mt-0.5 flex items-center gap-1">
                <TrendingDown className="w-3 h-3" />
                <span>-{signal?.risk_pct || 0}% Risk</span>
              </div>
            </div>

            <div className="bg-slate-950/40 border border-slate-800/60 rounded-lg p-3">
              <span className="text-xs text-slate-400 block mb-1">Risk / Reward Ratio</span>
              <div className="text-base font-bold text-brand">
                1 : {signal?.risk_reward_ratio || '1.0'}
              </div>
              <span className="text-[10px] text-slate-400 block mt-0.5">
                Risk Level: {signal?.risk_level || 'Medium'}
              </span>
            </div>

            <div className="bg-slate-950/40 border border-slate-800/60 rounded-lg p-3">
              <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                <span>Holding Time</span>
                <Clock className="w-3.5 h-3.5 text-slate-400" />
              </div>
              <div className="text-sm font-bold text-slate-200 truncate">
                {signal?.holding_time || '30–90 minutes'}
              </div>
              <span className="text-[10px] font-medium text-brand block mt-0.5">
                {activeTimeframe} Horizon
              </span>
            </div>
          </div>
        </>
      )}

      {/* Deterministic Reasons */}
      {signal?.reasons && signal.reasons.length > 0 && (
        <div className="border-t border-slate-800/80 pt-4">
          <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2.5">
            {isHolding ? 'Position Exit & Management Rationale' : 'Pre-Entry Signal Rationale'}
          </h4>
          <ul className="space-y-1.5">
            {signal.reasons.map((reason, idx) => (
              <li key={idx} className="flex items-start gap-2 text-xs text-slate-300 leading-relaxed">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0 mt-0.5" />
                <span>{reason}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
