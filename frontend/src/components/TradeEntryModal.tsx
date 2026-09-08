import React, { useState } from 'react';
import { X, TrendingUp, ShieldAlert, DollarSign, Target, CheckCircle2, ArrowRight, Zap } from 'lucide-react';
import { tradeStorageService } from '../services/trade_storage_service';

interface TradeEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  ticker: string;
  companyName: string;
  currentPrice: number;
  targetPrice?: number;
  stopLoss?: number;
  confidence?: number;
  signal?: string;
  onTradeCreated?: () => void;
}

export const TradeEntryModal: React.FC<TradeEntryModalProps> = ({
  isOpen,
  onClose,
  ticker,
  companyName,
  currentPrice,
  targetPrice: initialTarget,
  stopLoss: initialStop,
  confidence = 85,
  signal = 'BUY NOW',
  onTradeCreated
}) => {
  if (!isOpen) return null;

  const [entryPrice, setEntryPrice] = useState<number>(currentPrice);
  const [quantity, setQuantity] = useState<number>(10);
  const [targetPrice, setTargetPrice] = useState<number>(initialTarget || Number((currentPrice * 1.1).toFixed(2)));
  const [stopLoss, setStopLoss] = useState<number>(initialStop || Number((currentPrice * 0.95).toFixed(2)));

  const [enableTrailingStop, setEnableTrailingStop] = useState<boolean>(true);
  const [enableAutoExitTarget, setEnableAutoExitTarget] = useState<boolean>(true);
  const [enableAutoExitStop, setEnableAutoExitStop] = useState<boolean>(true);
  const [tradeNotes, setTradeNotes] = useState<string>('');

  // Live Metric Calculations
  const investmentVal = Number((entryPrice * quantity).toFixed(2));
  const upside = Math.max(targetPrice - entryPrice, 0.1);
  const downside = Math.max(entryPrice - stopLoss, 0.1);
  const riskRewardRatio = Number((upside / downside).toFixed(2));
  const expectedProfit = Number((upside * quantity).toFixed(2));
  const maxLoss = Number((downside * quantity).toFixed(2));

  const upsidePct = Number((((targetPrice - entryPrice) / entryPrice) * 100).toFixed(2));
  const downsidePct = Number((((entryPrice - stopLoss) / entryPrice) * 100).toFixed(2));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    tradeStorageService.startTrade({
      ticker,
      company_name: companyName,
      entry_price: entryPrice,
      quantity,
      target_price: targetPrice,
      stop_loss: stopLoss,
      confidence,
      signal,
      enable_trailing_stop: enableTrailingStop,
      enable_auto_exit_target: enableAutoExitTarget,
      enable_auto_exit_stop: enableAutoExitStop,
      trade_notes: tradeNotes
    });

    if (onTradeCreated) onTradeCreated();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-surface border border-borderDark rounded-2xl max-w-xl w-full flex flex-col gap-5 p-6 shadow-2xl font-sans text-sm">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-borderDark pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand/20 border border-brand/40 flex items-center justify-center text-brand">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white flex items-center gap-2 font-mono">
                <span>Configure Trade Position</span>
                <span className="text-xs bg-brand/10 border border-brand/30 text-brand px-2 py-0.5 rounded font-bold">
                  {ticker}
                </span>
              </h3>
              <p className="text-xs text-textMuted">{companyName}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-textMuted hover:text-white transition-all text-lg font-bold">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          
          {/* Entry Price & Quantity Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-mono text-textMuted mb-1 font-semibold">
                Entry Price (₹)
              </label>
              <input
                type="number"
                step="0.05"
                value={entryPrice}
                onChange={(e) => setEntryPrice(parseFloat(e.target.value) || 0)}
                className="w-full bg-background border border-borderDark rounded-xl px-3.5 py-2.5 text-white font-mono font-bold focus:border-brand outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-mono text-textMuted mb-1 font-semibold">
                Quantity (Shares)
              </label>
              <input
                type="number"
                min="1"
                value={quantity}
                onChange={(e) => setQuantity(parseInt(e.target.value, 10) || 1)}
                className="w-full bg-background border border-borderDark rounded-xl px-3.5 py-2.5 text-white font-mono font-bold focus:border-brand outline-none"
                required
              />
            </div>
          </div>

          {/* Profit Target & Stop Loss Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-mono text-emerald-400 mb-1 font-semibold flex items-center justify-between">
                <span>Profit Target (₹)</span>
                <span className="text-[10px] font-bold">+{upsidePct}%</span>
              </label>
              <input
                type="number"
                step="0.05"
                value={targetPrice}
                onChange={(e) => setTargetPrice(parseFloat(e.target.value) || 0)}
                className="w-full bg-background border border-emerald-500/40 rounded-xl px-3.5 py-2.5 text-emerald-400 font-mono font-bold focus:border-emerald-500 outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-mono text-rose-400 mb-1 font-semibold flex items-center justify-between">
                <span>Stop Loss (₹)</span>
                <span className="text-[10px] font-bold">-{downsidePct}%</span>
              </label>
              <input
                type="number"
                step="0.05"
                value={stopLoss}
                onChange={(e) => setStopLoss(parseFloat(e.target.value) || 0)}
                className="w-full bg-background border border-rose-500/40 rounded-xl px-3.5 py-2.5 text-rose-400 font-mono font-bold focus:border-rose-500 outline-none"
                required
              />
            </div>
          </div>

          {/* Live Risk & Reward Metrics Summary Card */}
          <div className="bg-background/80 border border-borderDark p-4 rounded-xl grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
            <div>
              <div className="text-[10px] text-textMuted">Investment</div>
              <div className="text-white font-bold text-sm mt-0.5">₹{investmentVal.toLocaleString('en-IN')}</div>
            </div>

            <div>
              <div className="text-[10px] text-textMuted">Risk/Reward</div>
              <div className="text-brand font-bold text-sm mt-0.5">1 : {riskRewardRatio}</div>
            </div>

            <div>
              <div className="text-[10px] text-emerald-400 font-semibold">Expected Profit</div>
              <div className="text-emerald-400 font-bold text-sm mt-0.5">+₹{expectedProfit.toLocaleString('en-IN')}</div>
            </div>

            <div>
              <div className="text-[10px] text-rose-400 font-semibold">Max Loss</div>
              <div className="text-rose-400 font-bold text-sm mt-0.5">-₹{maxLoss.toLocaleString('en-IN')}</div>
            </div>
          </div>

          {/* Automation & Exit Rules Toggles */}
          <div className="flex flex-col gap-2 bg-background/50 border border-borderDark/60 p-3 rounded-xl">
            <div className="text-xs font-bold text-slate-300 font-mono flex items-center gap-1.5 mb-1">
              <Zap className="w-3.5 h-3.5 text-brand" />
              <span>Automated Exit Engine Rules</span>
            </div>

            <label className="flex items-center justify-between cursor-pointer text-xs font-mono">
              <span className="text-textMuted">Auto Exit when Target is Hit</span>
              <input
                type="checkbox"
                checked={enableAutoExitTarget}
                onChange={(e) => setEnableAutoExitTarget(e.target.checked)}
                className="accent-brand w-4 h-4 cursor-pointer"
              />
            </label>

            <label className="flex items-center justify-between cursor-pointer text-xs font-mono">
              <span className="text-textMuted">Auto Exit when Stop Loss is Hit</span>
              <input
                type="checkbox"
                checked={enableAutoExitStop}
                onChange={(e) => setEnableAutoExitStop(e.target.checked)}
                className="accent-brand w-4 h-4 cursor-pointer"
              />
            </label>

            <label className="flex items-center justify-between cursor-pointer text-xs font-mono">
              <span className="text-textMuted">Dynamic Trailing Stop Loss</span>
              <input
                type="checkbox"
                checked={enableTrailingStop}
                onChange={(e) => setEnableTrailingStop(e.target.checked)}
                className="accent-brand w-4 h-4 cursor-pointer"
              />
            </label>
          </div>

          {/* Trade Notes Input */}
          <div>
            <label className="block text-xs font-mono text-textMuted mb-1 font-semibold">
              Trade Strategy Notes (Optional)
            </label>
            <textarea
              rows={2}
              value={tradeNotes}
              onChange={(e) => setTradeNotes(e.target.value)}
              placeholder="e.g. Earnings breakout strategy, trailing stop at 50% profit..."
              className="w-full bg-background border border-borderDark rounded-xl p-3 text-white font-sans text-xs focus:border-brand outline-none resize-none"
            />
          </div>

          {/* Submit Action Button */}
          <button
            type="submit"
            className="w-full bg-brand text-white font-mono font-bold py-3 rounded-xl hover:bg-brand/90 transition-all shadow-lg shadow-brand/20 flex items-center justify-center gap-2 mt-1"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Confirm & Open Trade Position</span>
          </button>
        </form>
      </div>
    </div>
  );
};
