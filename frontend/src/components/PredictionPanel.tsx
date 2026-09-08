import React, { useState } from 'react';
import { PredictionHorizon, PredictionResult } from '../types';
import { Sparkles, TrendingUp, TrendingDown, Target, Shield, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';

interface PredictionPanelProps {
  prediction: PredictionResult | null;
  horizon: PredictionHorizon;
  onHorizonChange: (horizon: PredictionHorizon) => void;
}

const recColors: Record<string, string> = {
  'STRONG BUY': 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 font-bold',
  'BUY': 'bg-bullish/20 text-bullish border-bullish/40 font-bold',
  'ACCUMULATE': 'bg-teal-500/20 text-teal-300 border-teal-500/40 font-bold',
  'HOLD': 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40 font-bold',
  'REDUCE': 'bg-orange-500/20 text-orange-400 border-orange-500/40 font-bold',
  'SELL': 'bg-bearish/20 text-bearish border-bearish/40 font-bold',
  'STRONG SELL': 'bg-rose-600/20 text-rose-400 border-rose-600/40 font-bold',
};

export const PredictionPanel: React.FC<PredictionPanelProps> = ({ prediction, horizon, onHorizonChange }) => {
  const [trackRecordOpen, setTrackRecordOpen] = useState(false);

  return (
  <div className="bg-surface border border-borderDark p-6 rounded-2xl flex flex-col gap-5">
    <div className="flex flex-wrap items-center justify-between gap-4 border-b border-borderDark pb-4">
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-brand/10 border border-brand/20 flex items-center justify-center text-brand">
          <Sparkles className="w-4 h-4" />
        </div>
        <div>
          <h3 className="font-bold text-base text-white">Live AI Prediction Engine</h3>
          <p className="text-xs text-textMuted font-mono">Horizon-specific probability engine</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-xs font-mono text-textMuted uppercase">Horizon:</span>
        <select 
          value={horizon} 
          onChange={e => onHorizonChange(e.target.value as PredictionHorizon)} 
          className="bg-background border border-borderDark rounded-xl px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-brand"
        >
          <option value="5m">5 Minutes</option>
          <option value="10m">10 Minutes</option>
          <option value="15m">15 Minutes</option>
          <option value="30m">30 Minutes</option>
          <option value="1d">1 Day</option>
          <option value="1w">1 Week</option>
          <option value="1mo">1 Month</option>
        </select>
      </div>
    </div>

    {prediction ? (
      <div className="flex flex-col gap-5">
        {/* Recommendation Hero Card */}
        <div className="p-4 rounded-xl bg-background/80 border border-borderDark flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className={`text-xs px-3 py-1.5 rounded-full border ${recColors[prediction.recommendation] || recColors.HOLD}`}>
              {prediction.recommendation}
            </span>
            <div className="flex flex-col">
              <span className="text-[10px] font-mono text-textMuted uppercase">DIRECTION</span>
              <span className="text-xs font-bold font-mono text-white flex items-center gap-1">
                {prediction.direction === 'UP' ? (
                  <span className="text-bullish flex items-center"><TrendingUp className="w-3.5 h-3.5 mr-1" /> BULLISH UP</span>
                ) : prediction.direction === 'DOWN' ? (
                  <span className="text-bearish flex items-center"><TrendingDown className="w-3.5 h-3.5 mr-1" /> BEARISH DOWN</span>
                ) : (
                  <span className="text-yellow-400">NEUTRAL</span>
                )}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="text-right font-mono">
              <span className="text-[10px] text-textMuted uppercase block">Probability</span>
              <span className="text-base font-bold text-white">{prediction.probability}%</span>
            </div>
            <div className="text-right font-mono">
              <span className="text-[10px] text-textMuted uppercase block">Confidence</span>
              <span className="text-base font-bold text-brand">{prediction.confidence}%</span>
            </div>
          </div>
        </div>

        {/* Honest Model Track Record - probability/confidence above are a
            single input, not a guarantee; this grounds them in how the
            model has actually performed historically. */}
        <div className="rounded-xl bg-amber-500/5 border border-amber-500/20 overflow-hidden">
          <button
            onClick={() => setTrackRecordOpen(o => !o)}
            className="w-full flex items-center justify-between gap-2.5 p-3.5 text-left"
          >
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <span className="text-[11px] text-textMuted leading-relaxed">
                <span className="text-amber-400 font-bold">Model track record: </span>
                1-day directional calls were correct <span className="text-white font-bold">45.6%</span> of the time in an honest out-of-sample backtest — below a coin flip.
              </span>
            </div>
            {trackRecordOpen ? <ChevronUp className="w-3.5 h-3.5 text-textMuted shrink-0 mt-0.5" /> : <ChevronDown className="w-3.5 h-3.5 text-textMuted shrink-0 mt-0.5" />}
          </button>
          {trackRecordOpen && (
            <div className="px-3.5 pb-3.5 -mt-1 text-[11px] text-textMuted leading-relaxed border-t border-amber-500/10 pt-3">
              <p>
                Methodology: 80 simulated trades across 10 liquid NSE stocks and 8 entry dates spread over 6 months, each using only data available up to that entry day (no lookahead bias) with the same production prediction engine. 26 of 57 directional (UP/DOWN) calls were correct; the other 23 calls were NEUTRAL. Win rate on P&amp;L was 42.1%.
              </p>
              <p className="mt-2">
                Treat probability and confidence as one input among the reasons listed below — not a signal to act on alone. This is a research aid, not investment advice.
              </p>
            </div>
          )}
        </div>

        {/* Metric Cards Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
          <div className="p-3 bg-background/60 border border-borderDark/60 rounded-xl">
            <span className="text-[10px] text-textMuted block mb-1">EXPECTED MOVE</span>
            <span className={`text-sm font-bold ${prediction.expected_move_pct >= 0 ? 'text-bullish' : 'text-bearish'}`}>
              {prediction.expected_move_pct >= 0 ? '+' : ''}{prediction.expected_move_pct}%
            </span>
          </div>

          <div className="p-3 bg-background/60 border border-borderDark/60 rounded-xl">
            <span className="text-[10px] text-textMuted block mb-1">TARGET PRICE</span>
            <span className="text-sm font-bold text-white">₹{prediction.target_price}</span>
          </div>

          <div className="p-3 bg-background/60 border border-borderDark/60 rounded-xl">
            <span className="text-[10px] text-textMuted block mb-1">STOP LOSS</span>
            <span className="text-sm font-bold text-amber-400">₹{prediction.stop_loss}</span>
          </div>

          <div className="p-3 bg-background/60 border border-borderDark/60 rounded-xl">
            <span className="text-[10px] text-textMuted block mb-1">RISK PROFILE</span>
            <span className="text-sm font-bold text-slate-200">{prediction.risk}</span>
          </div>
        </div>

        {/* Key Reasons List */}
        {prediction.reasons && prediction.reasons.length > 0 && (
          <div className="p-4 bg-background/50 border border-borderDark/50 rounded-xl flex flex-col gap-2">
            <span className="text-[10px] font-mono text-textMuted uppercase font-bold tracking-wider">
              Catalysts & Reasoning:
            </span>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs font-sans text-slate-300">
              {prediction.reasons.map((reason, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <span className="text-brand font-mono font-bold">•</span>
                  <span>{reason}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    ) : (
      <div className="p-6 text-center text-xs text-textMuted">Computing prediction model...</div>
    )}
  </div>
  );
};
