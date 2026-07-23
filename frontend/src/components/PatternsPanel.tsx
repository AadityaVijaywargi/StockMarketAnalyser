import React from 'react';
import { PatternDetection } from '../types';
import { Sparkles, Calendar, Zap, AlertTriangle } from 'lucide-react';
import { formatPercentage, formatPrice } from '../utils/formatter';

interface PatternsPanelProps {
  patterns: PatternDetection[];
}

export const PatternsPanel: React.FC<PatternsPanelProps> = ({ patterns }) => {
  const dirColors = {
    BULLISH: 'text-bullish border-bullish/20 bg-bullish/5',
    BEARISH: 'text-bearish border-bearish/20 bg-bearish/5',
    NEUTRAL: 'text-yellow-500 border-yellow-500/20 bg-yellow-500/5',
  };

  const statusColors = {
    Forming: 'text-yellow-500 bg-yellow-500/5 border-yellow-500/10',
    Confirmed: 'text-bullish bg-bullish/5 border-bullish/10',
    Invalidated: 'text-bearish bg-bearish/5 border-bearish/10',
  };

  return (
    <div className="bg-surface border border-borderDark p-6 rounded-xl flex flex-col gap-5 h-full">
      <div className="flex items-center gap-3 border-b border-borderDark pb-4">
        <div className="w-8 h-8 rounded bg-brand/10 border border-brand/20 flex items-center justify-center">
          <Sparkles className="w-4 h-4 text-brand" />
        </div>
        <h3 className="font-bold text-base text-white">Algorithmic Pattern Detections</h3>
      </div>

      {patterns.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-center text-textMuted border border-dashed border-borderDark rounded-lg bg-background/50">
          <AlertTriangle className="w-8 h-8 mb-2 opacity-50" />
          <span className="text-sm font-medium">No active chart patterns detected</span>
          <p className="text-xs max-w-[250px] mt-1 leading-relaxed">The stock is currently consolidating without forming distinct geometric shapes.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[380px] overflow-y-auto pr-1">
          {patterns.map((p, idx) => (
            <div key={idx} className="bg-background border border-borderDark p-4 rounded-lg flex flex-col justify-between hover:border-brand/20 transition-all">
              <div className="flex justify-between items-start gap-2">
                <div>
                  <h4 className="font-bold text-sm text-white">{p.pattern_name}</h4>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`px-2 py-0.5 rounded text-[9px] font-mono border ${dirColors[p.pattern_direction]}`}>
                      {p.pattern_direction}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-[9px] font-mono border ${statusColors[p.pattern_status]}`}>
                      {p.pattern_status.toUpperCase()}
                    </span>
                  </div>
                </div>
                
                <div className="text-right flex flex-col items-end">
                  <span className="text-[9px] text-textMuted font-mono">CONFIDENCE</span>
                  <span className="text-xs font-bold text-white font-mono mt-0.5">
                    {formatPercentage(p.confidence_score != null ? p.confidence_score * 100 : null, 0)}
                  </span>
                </div>
              </div>

              {/* Timeframes and Evidence details */}
              <div className="mt-4 pt-3 border-t border-borderDark/40 flex flex-col gap-2 text-[11px] font-mono text-textMuted">
                <div className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 opacity-60" />
                  <span>{p.start_date} to {p.end_date}</span>
                </div>
                {p.key_price_levels.length > 0 && (
                  <div className="flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 opacity-60 text-brand" />
                    <span>Neckline: {formatPrice(p.key_price_levels[p.key_price_levels.length - 1])}</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
