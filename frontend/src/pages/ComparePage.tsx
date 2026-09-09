import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { createChart, ColorType, IChartApi } from 'lightweight-charts';
import { DeterministicAnalysisReport } from '../types';
import { apiService } from '../services/api';
import { SearchBar } from '../components/search/SearchBar';
import { GitCompare, X, Loader2, TrendingUp, TrendingDown, AlertCircle, Download } from 'lucide-react';

const MAX_COMPARE = 4;

// Client-side window over the single 1y-daily series analyzeTicker already
// fetches - avoids a re-fetch per timeframe click. Trading-day counts, not
// calendar days.
const LOOKBACK_WINDOWS: Record<string, number> = { '1M': 21, '3M': 63, '6M': 126, '1Y': 252 };
const LINE_COLORS = ['#3b82f6', '#f59e0b', '#10b981', '#ec4899'];

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
  const [lookback, setLookback] = useState<string>('1Y');
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

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

  // Supports "Compare Selected" from the watchlist: /compare?tickers=A.NS,B.NS
  const [searchParams] = useSearchParams();
  const prefillHandled = useRef(false);
  useEffect(() => {
    if (prefillHandled.current) return;
    const raw = searchParams.get('tickers');
    if (!raw) return;
    prefillHandled.current = true;
    raw.split(',').map(t => t.trim()).filter(Boolean).slice(0, MAX_COMPARE).forEach(addTicker);
  }, [searchParams, addTicker]);

  const removeTicker = (ticker: string) => {
    setSlots(prev => prev.filter(s => s.ticker !== ticker));
  };

  // Normalized % change from the first close in the selected lookback
  // window, so stocks trading at wildly different price levels (e.g. a
  // ₹150 stock vs a ₹15,000 stock) can be overlaid on one chart.
  const getNormalizedSeries = (report: DeterministicAnalysisReport) => {
    const { dates, close } = report.chart_data;
    if (!dates?.length || !close?.length) return [];
    const windowSize = LOOKBACK_WINDOWS[lookback] ?? close.length;
    const start = Math.max(0, close.length - windowSize);
    const windowDates = dates.slice(start);
    const windowClose = close.slice(start);
    const base = windowClose[0];
    if (!base) return [];
    return windowDates.map((d, i) => ({ time: d, value: ((windowClose[i] - base) / base) * 100 }));
  };

  const loadedSlots = slots.filter(s => s.report);

  useEffect(() => {
    if (!chartContainerRef.current || loadedSlots.length === 0) return;
    chartContainerRef.current.innerHTML = '';

    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: 320,
      layout: {
        background: { type: ColorType.Solid, color: '#09090b' },
        textColor: '#94a3b8',
        fontSize: 11,
        fontFamily: "'Inter', sans-serif",
      },
      grid: {
        vertLines: { color: 'rgba(30, 41, 59, 0.3)' },
        horzLines: { color: 'rgba(30, 41, 59, 0.3)' },
      },
      rightPriceScale: { borderColor: '#1e293b' },
      timeScale: { borderColor: '#1e293b' },
      localization: { priceFormatter: (p: number) => `${p >= 0 ? '+' : ''}${p.toFixed(1)}%` },
    });
    chartRef.current = chart;

    loadedSlots.forEach((slot, idx) => {
      const series = chart.addLineSeries({
        color: LINE_COLORS[idx % LINE_COLORS.length],
        lineWidth: 2,
        title: slot.ticker.replace('.NS', '').replace('.BO', ''),
      });
      series.setData(getNormalizedSeries(slot.report!));
    });

    const zeroLine = chart.addLineSeries({ color: 'rgba(148, 163, 184, 0.4)', lineWidth: 1, lineStyle: 3 });
    const anyDates = loadedSlots[0]?.report?.chart_data.dates || [];
    const windowSize = LOOKBACK_WINDOWS[lookback] ?? anyDates.length;
    const start = Math.max(0, anyDates.length - windowSize);
    const zeroData = anyDates.slice(start).map(d => ({ time: d, value: 0 }));
    zeroLine.setData(zeroData);

    chart.timeScale().fitContent();

    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.resize(chartContainerRef.current.clientWidth, 320);
      }
    };
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(chartContainerRef.current);
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      resizeObserver.disconnect();
      chart.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadedSlots.map(s => s.ticker).join(','), lookback]);

  const handleExportCSV = () => {
    if (loadedSlots.length === 0) return;
    const header = ['Metric', ...loadedSlots.map(s => s.ticker)].join(',') + '\n';
    const rows: string[] = [];
    const addRow = (label: string, values: (string | number)[]) => rows.push([label, ...values].join(','));
    addRow('Company', loadedSlots.map(s => `"${s.report!.company_name}"`));
    addRow('Price', loadedSlots.map(s => s.report!.chart_data.close[s.report!.chart_data.close.length - 1].toFixed(2)));
    addRow('Recommendation', loadedSlots.map(s => s.report!.scores.recommendation));
    addRow('Overall Score', loadedSlots.map(s => s.report!.scores.overall_score.toFixed(1)));
    addRow('Confidence', loadedSlots.map(s => (s.report!.scores.confidence ?? 0).toFixed(0)));
    addRow('Risk Level', loadedSlots.map(s => s.report!.risk_profile.level));
    addRow('Annualized Volatility', loadedSlots.map(s => s.report!.risk_profile.annualized_volatility.toFixed(1)));
    addRow(`Performance (${lookback})`, loadedSlots.map(s => {
      const series = getNormalizedSeries(s.report!);
      return series.length ? series[series.length - 1].value.toFixed(2) + '%' : '--';
    }));
    const csvContent = header + rows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `STONKS_Compare_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
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
        <>
          {loadedSlots.length > 0 && (
            <div className="bg-surface border border-borderDark rounded-2xl p-5 shadow-lg">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                <h3 className="font-bold text-sm text-white font-mono flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-brand" />
                  <span>Normalized Performance</span>
                </h3>
                <div className="flex items-center bg-background border border-borderDark/80 p-1 rounded-xl gap-1 font-mono text-xs">
                  {Object.keys(LOOKBACK_WINDOWS).map(w => (
                    <button
                      key={w}
                      onClick={() => setLookback(w)}
                      className={`px-3 py-1 rounded-lg font-bold transition-all ${
                        lookback === w ? 'bg-brand text-white shadow-md shadow-brand/20' : 'text-textMuted hover:text-white hover:bg-white/[0.04]'
                      }`}
                    >
                      {w}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3 mb-3 font-mono text-[11px]">
                {loadedSlots.map((s, idx) => {
                  const series = getNormalizedSeries(s.report!);
                  const last = series.length ? series[series.length - 1].value : 0;
                  return (
                    <span key={s.ticker} className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: LINE_COLORS[idx % LINE_COLORS.length] }} />
                      <span className="text-white font-bold">{s.ticker.replace('.NS', '').replace('.BO', '')}</span>
                      <span className={last >= 0 ? 'text-bullish' : 'text-bearish'}>{last >= 0 ? '+' : ''}{last.toFixed(2)}%</span>
                    </span>
                  );
                })}
              </div>
              <div ref={chartContainerRef} className="w-full rounded-xl overflow-hidden border border-borderDark/60" />
            </div>
          )}

        <div className="bg-surface border border-borderDark rounded-2xl shadow-lg overflow-x-auto">
          <div className="flex items-center justify-end p-3 border-b border-borderDark/60">
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-brand/15 border border-brand/40 text-brand rounded-lg text-[11px] font-mono font-bold hover:bg-brand/25 transition-all"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
          </div>
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
              {metricRow(`Performance (${lookback})`, s => {
                const series = getNormalizedSeries(s.report!);
                const last = series.length ? series[series.length - 1].value : null;
                return last === null ? '—' : (
                  <span className={`font-bold ${last >= 0 ? 'text-bullish' : 'text-bearish'}`}>{last >= 0 ? '+' : ''}{last.toFixed(2)}%</span>
                );
              })}
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
        </>
      )}
    </div>
  );
};

export default ComparePage;
