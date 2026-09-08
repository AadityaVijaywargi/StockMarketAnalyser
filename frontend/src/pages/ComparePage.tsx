import React, { useState, useCallback } from 'react';
import { DeterministicAnalysisReport } from '../types';
import { apiService } from '../services/api';
import { SearchBar } from '../components/search/SearchBar';
import { GitCompare, X, Loader2, TrendingUp, TrendingDown, AlertCircle } from 'lucide-react';

const MAX_COMPARE = 4;

interface ComparisonSlot {
  ticker: string;
  report: DeterministicAnalysisReport | null;
  isLoading: boolean;
  error: string | null;
}

const recColor = (rec?: string) => {
  if (!rec) return 'text-textMuted';
  if (['STRONG BUY', 'BUY', 'ACCUMULATE'].includes(rec)) return 'text-bullish';
  if (['REDUCE', 'SELL', 'STRONG SELL'].includes(rec)) return 'text-bearish';
  return 'text-yellow-500';
};

const riskColor = (level?: string) => {
  if (level === 'Low') return 'text-bullish';
  if (level === 'Moderate') return 'text-yellow-500';
  return 'text-bearish';
};

export const ComparePage: React.FC = () => {
  const [slots, setSlots] = useState<ComparisonSlot[]>([]);

  const addTicker = useCallback(async (rawTicker: string) => {
    const ticker = rawTicker.toUpperCase().trim();
    setSlots(prev => {
      if (prev.length >= MAX_COMPARE) return prev;
      if (prev.some(s => s.ticker.toUpperCase() === ticker)) return prev;
      return [...prev, { ticker, report: null, isLoading: true, error: null }];
    });

    try {
      const report = await apiService.analyzeTicker(ticker);
      setSlots(prev => prev.map(s => s.ticker.toUpperCase() === ticker ? { ...s, report, isLoading: false } : s));
    } catch (err: any) {
      const detail = err?.response?.data?.detail || 'Failed to load analysis.';
      setSlots(prev => prev.map(s => s.ticker.toUpperCase() === ticker ? { ...s, isLoading: false, error: detail } : s));
    }
  }, []);

  const removeTicker = (ticker: string) => {
    setSlots(prev => prev.filter(s => s.ticker !== ticker));
  };

  const metricRow = (label: string, render: (s: ComparisonSlot) => React.ReactNode) => (
    <tr className="border-b border-borderDark/60">
      <td className="py-3 pr-4 text-xs text-textMuted font-mono whitespace-nowrap sticky left-0 bg-surface">{label}</td>
      {slots.map(s => (
        <td key={s.ticker} className="py-3 px-4 text-sm font-mono text-center min-w-[140px]">
          {s.report ? render(s) : s.error ? <span className="text-bearish text-xs">—</span> : <Loader2 className="w-4 h-4 animate-spin text-textMuted mx-auto" />}
        </td>
      ))}
    </tr>
  );

  return (
    <div className="min-h-screen bg-background text-text font-sans p-6 md:p-8 flex flex-col gap-6 max-w-6xl mx-auto">
      <div className="border-b border-borderDark/80 pb-5">
        <h1 className="font-extrabold text-2xl text-white tracking-tight flex items-center gap-2.5 font-mono">
          <GitCompare className="w-6 h-6 text-brand" />
          <span>Compare Stocks</span>
        </h1>
        <p className="text-xs text-textMuted mt-1">Pick up to {MAX_COMPARE} stocks to see their scores and metrics side by side.</p>
      </div>

      {slots.length < MAX_COMPARE && (
        <SearchBar onSearch={addTicker} placeholder="Add a stock to compare..." />
      )}

      {slots.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-20 text-textMuted">
          <GitCompare className="w-10 h-10 opacity-30" />
          <p className="text-sm">Search for a stock above to start comparing.</p>
        </div>
      ) : (
        <div className="bg-surface border border-borderDark rounded-2xl shadow-lg overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-borderDark">
                <td className="py-3 pr-4 sticky left-0 bg-surface"></td>
                {slots.map(s => (
                  <td key={s.ticker} className="py-3 px-4 min-w-[140px]">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-white truncate">{s.report?.company_name || s.ticker.replace('.NS', '').replace('.BO', '')}</div>
                        <div className="text-[10px] text-textMuted font-mono">{s.ticker}</div>
                      </div>
                      <button onClick={() => removeTicker(s.ticker)} className="p-1 rounded text-textMuted hover:text-bearish transition-colors shrink-0" title="Remove">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    {s.error && (
                      <div className="flex items-center gap-1 text-bearish text-[10px] mt-1">
                        <AlertCircle className="w-3 h-3" /> <span className="line-clamp-1">{s.error}</span>
                      </div>
                    )}
                  </td>
                ))}
              </tr>
            </thead>
            <tbody>
              {metricRow('Price', s => `₹${s.report!.chart_data.close[s.report!.chart_data.close.length - 1].toFixed(2)}`)}
              {metricRow('Recommendation', s => (
                <span className={`font-bold ${recColor(s.report!.scores.recommendation)}`}>{s.report!.scores.recommendation}</span>
              ))}
              {metricRow('Overall Score', s => `${s.report!.scores.overall_score.toFixed(1)}/100`)}
              {metricRow('Confidence', s => `${(s.report!.scores.confidence ?? 0).toFixed(0)}%`)}
              {metricRow('Risk Level', s => (
                <span className={`font-bold ${riskColor(s.report!.risk_profile.level)}`}>{s.report!.risk_profile.level}</span>
              ))}
              {metricRow('Annualized Volatility', s => `${s.report!.risk_profile.annualized_volatility.toFixed(1)}%`)}
              {metricRow('Trend Score', s => s.report!.scores.trend.value.toFixed(0))}
              {metricRow('Momentum Score', s => s.report!.scores.momentum.value.toFixed(0))}
              {metricRow('Volume Score', s => s.report!.scores.volume.value.toFixed(0))}
              {metricRow('Target Price', s => s.report!.prediction?.target_price ? (
                <span className="text-bullish flex items-center justify-center gap-1"><TrendingUp className="w-3 h-3" />₹{s.report!.prediction!.target_price.toFixed(2)}</span>
              ) : '—')}
              {metricRow('Stop Loss', s => s.report!.prediction?.stop_loss ? (
                <span className="text-bearish flex items-center justify-center gap-1"><TrendingDown className="w-3 h-3" />₹{s.report!.prediction!.stop_loss.toFixed(2)}</span>
              ) : '—')}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default ComparePage;
