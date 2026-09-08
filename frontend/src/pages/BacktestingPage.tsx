import React, { useEffect, useRef, useState } from 'react';
import { createChart, ColorType, IChartApi } from 'lightweight-charts';
import {
  Play, TrendingUp, TrendingDown, Percent, Activity, ShieldAlert,
  Target, Loader2, AlertCircle, BarChart2
} from 'lucide-react';
import { apiService } from '../services/api';
import { BacktestResult } from '../types';

const PERIOD_OPTIONS = ['1y', '2y', '5y', 'max'];

export const BacktestingPage: React.FC = () => {
  const [ticker, setTicker] = useState<string>('RELIANCE.NS');
  const [period, setPeriod] = useState<string>('5y');
  const [capital, setCapital] = useState<number>(100000);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<BacktestResult | null>(null);

  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  const runBacktest = async () => {
    const cleanTicker = ticker.toUpperCase().trim();
    if (!cleanTicker) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await apiService.runBacktest(cleanTicker, period, capital);
      setResult(data);
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Unable to run backtest for this ticker. Check the symbol and try again.');
      setResult(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!chartContainerRef.current || !result) return;
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
      timeScale: { borderColor: '#1e293b', timeVisible: false },
    });
    chartRef.current = chart;

    const isProfit = result.metrics.total_return_pct >= 0;
    const series = chart.addAreaSeries({
      topColor: isProfit ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.4)',
      bottomColor: isProfit ? 'rgba(16, 185, 129, 0.0)' : 'rgba(239, 68, 68, 0.0)',
      lineColor: isProfit ? '#10b981' : '#ef4444',
      lineWidth: 2,
    });
    series.setData(result.equity_curve.map(p => ({ time: p.date, value: p.value })));

    const initialLine = series.createPriceLine({
      price: result.initial_capital,
      color: '#64748b',
      lineWidth: 1,
      lineStyle: 2,
      axisLabelVisible: true,
      title: 'Initial Capital',
    });
    void initialLine;

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
  }, [result]);

  const metrics = result?.metrics;

  return (
    <div className="min-h-screen bg-background text-text font-sans p-6 md:p-8 flex flex-col gap-6 max-w-7xl mx-auto">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-borderDark/80 pb-5">
        <div>
          <h1 className="font-extrabold text-2xl text-white tracking-tight flex items-center gap-2.5 font-mono">
            <BarChart2 className="w-6 h-6 text-brand" />
            <span>Strategy Backtesting</span>
          </h1>
          <p className="text-xs text-textMuted mt-1">
            Simulates {result?.strategy_name || 'a Trend + Momentum (SMA50/200, RSI14)'} strategy against real historical daily data, one position at a time, with an ATR-based stop loss and target.
          </p>
        </div>
      </div>

      {/* Run Controls */}
      <div className="bg-surface border border-borderDark p-4 rounded-2xl shadow-lg flex flex-col sm:flex-row items-stretch sm:items-end gap-3 font-mono text-xs">
        <div className="flex flex-col gap-1.5 flex-1">
          <label className="text-textMuted font-semibold">Ticker</label>
          <input
            value={ticker}
            onChange={e => setTicker(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') runBacktest(); }}
            placeholder="e.g. RELIANCE.NS"
            className="bg-background border border-borderDark/80 rounded-xl px-3 py-2 text-white outline-none focus:border-brand/60"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-textMuted font-semibold">Lookback Period</label>
          <div className="flex items-center bg-background border border-borderDark/80 p-1 rounded-xl gap-1">
            {PERIOD_OPTIONS.map(p => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                  period === p ? 'bg-brand text-white shadow-md shadow-brand/20' : 'text-textMuted hover:text-white hover:bg-white/[0.04]'
                }`}
              >
                {p.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-textMuted font-semibold">Initial Capital (₹)</label>
          <input
            type="number"
            min={1000}
            step={1000}
            value={capital}
            onChange={e => setCapital(Number(e.target.value) || 0)}
            className="bg-background border border-borderDark/80 rounded-xl px-3 py-2 text-white outline-none focus:border-brand/60 w-36"
          />
        </div>
        <button
          onClick={runBacktest}
          disabled={isLoading}
          className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-brand text-white font-bold hover:bg-brand/90 transition-all shadow-md shadow-brand/20 disabled:opacity-60"
        >
          {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
          <span>{isLoading ? 'Simulating...' : 'Run Backtest'}</span>
        </button>
      </div>

      {error && (
        <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 p-3.5 rounded-xl flex items-center gap-2.5 text-xs font-mono font-semibold">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {isLoading && !result && (
        <div className="bg-surface border border-borderDark/80 p-16 rounded-2xl text-center text-textMuted flex flex-col items-center gap-3">
          <Loader2 className="w-7 h-7 animate-spin text-brand" />
          <span className="font-mono text-xs font-bold">Replaying historical bars and simulating trades...</span>
        </div>
      )}

      {!result && !isLoading && !error && (
        <div className="bg-surface border border-borderDark/80 p-16 rounded-2xl text-center text-textMuted flex flex-col items-center gap-3">
          <BarChart2 className="w-10 h-10 text-textMuted/50" />
          <span className="font-mono text-xs">Enter a ticker and run a backtest to see results here.</span>
        </div>
      )}

      {metrics && result && (
        <>
          {/* Metric Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            <div className="bg-surface border border-borderDark p-4 rounded-2xl flex flex-col gap-1.5 shadow-lg">
              <div className="flex items-center gap-1.5 text-textMuted text-[11px] font-mono font-bold">
                {metrics.total_return_pct >= 0 ? <TrendingUp className="w-3.5 h-3.5 text-emerald-400" /> : <TrendingDown className="w-3.5 h-3.5 text-rose-400" />}
                <span>Total Return</span>
              </div>
              <span className={`text-xl font-extrabold font-mono ${metrics.total_return_pct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {metrics.total_return_pct >= 0 ? '+' : ''}{metrics.total_return_pct}%
              </span>
            </div>

            <div className="bg-surface border border-borderDark p-4 rounded-2xl flex flex-col gap-1.5 shadow-lg">
              <div className="flex items-center gap-1.5 text-textMuted text-[11px] font-mono font-bold">
                <Activity className="w-3.5 h-3.5 text-brand" />
                <span>CAGR</span>
              </div>
              <span className="text-xl font-extrabold font-mono text-white">{metrics.cagr_pct}%</span>
            </div>

            <div className="bg-surface border border-borderDark p-4 rounded-2xl flex flex-col gap-1.5 shadow-lg">
              <div className="flex items-center gap-1.5 text-textMuted text-[11px] font-mono font-bold">
                <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
                <span>Max Drawdown</span>
              </div>
              <span className="text-xl font-extrabold font-mono text-amber-400">{metrics.max_drawdown_pct}%</span>
            </div>

            <div className="bg-surface border border-borderDark p-4 rounded-2xl flex flex-col gap-1.5 shadow-lg">
              <div className="flex items-center gap-1.5 text-textMuted text-[11px] font-mono font-bold">
                <Percent className="w-3.5 h-3.5 text-purple-400" />
                <span>Sharpe Ratio</span>
              </div>
              <span className="text-xl font-extrabold font-mono text-white">{metrics.sharpe_ratio}</span>
            </div>

            <div className="bg-surface border border-borderDark p-4 rounded-2xl flex flex-col gap-1.5 shadow-lg">
              <div className="flex items-center gap-1.5 text-textMuted text-[11px] font-mono font-bold">
                <Target className="w-3.5 h-3.5 text-blue-400" />
                <span>Win Rate</span>
              </div>
              <span className="text-xl font-extrabold font-mono text-white">{metrics.win_rate_pct}%</span>
              <span className="text-[10px] text-textMuted">{metrics.total_trades} trades</span>
            </div>

            <div className="bg-surface border border-borderDark p-4 rounded-2xl flex flex-col gap-1.5 shadow-lg">
              <div className="flex items-center gap-1.5 text-textMuted text-[11px] font-mono font-bold">
                <BarChart2 className="w-3.5 h-3.5 text-textMuted" />
                <span>Avg Win / Loss</span>
              </div>
              <span className="text-sm font-extrabold font-mono">
                <span className="text-emerald-400">+{metrics.avg_win_pct}%</span>
                <span className="text-textMuted"> / </span>
                <span className="text-rose-400">{metrics.avg_loss_pct}%</span>
              </span>
            </div>
          </div>

          {/* Equity Curve */}
          <div className="bg-surface border border-borderDark p-5 rounded-2xl shadow-xl">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-sm text-white font-mono flex items-center gap-2">
                <Activity className="w-4 h-4 text-brand" />
                <span>Equity Curve — {result.ticker} ({result.period.toUpperCase()}, {result.bars_simulated} bars)</span>
              </h3>
              <span className="text-xs font-mono text-textMuted">
                Final Value: <span className="text-white font-bold">₹{metrics.final_value.toLocaleString('en-IN')}</span>
              </span>
            </div>
            <div ref={chartContainerRef} className="w-full rounded-xl overflow-hidden border border-borderDark/60" />
          </div>

          {/* Trade Log */}
          <div className="bg-surface border border-borderDark rounded-2xl overflow-hidden shadow-xl">
            <div className="p-4 border-b border-borderDark/60">
              <h3 className="font-bold text-sm text-white font-mono">Trade Log ({result.trades.length})</h3>
            </div>
            {result.trades.length === 0 ? (
              <div className="p-10 text-center text-textMuted text-xs font-mono">No trades were triggered over this period.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs font-mono">
                  <thead>
                    <tr className="text-textMuted border-b border-borderDark/60">
                      <th className="text-left p-3 font-semibold">Entry Date</th>
                      <th className="text-left p-3 font-semibold">Exit Date</th>
                      <th className="text-right p-3 font-semibold">Entry ₹</th>
                      <th className="text-right p-3 font-semibold">Exit ₹</th>
                      <th className="text-right p-3 font-semibold">P&amp;L %</th>
                      <th className="text-left p-3 font-semibold">Exit Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.trades.slice().reverse().map((t, i) => (
                      <tr key={i} className="border-b border-borderDark/30 hover:bg-white/[0.02]">
                        <td className="p-3 text-slate-300">{t.entry_date}</td>
                        <td className="p-3 text-slate-300">{t.exit_date}</td>
                        <td className="p-3 text-right text-slate-300">{t.entry_price}</td>
                        <td className="p-3 text-right text-slate-300">{t.exit_price}</td>
                        <td className={`p-3 text-right font-bold ${t.pnl_pct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {t.pnl_pct >= 0 ? '+' : ''}{t.pnl_pct}%
                        </td>
                        <td className="p-3 text-textMuted">{t.exit_reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {result.open_position && (
              <div className="p-3 border-t border-borderDark/60 bg-brand/5 text-xs font-mono text-brand flex items-center gap-2">
                <Activity className="w-3.5 h-3.5" />
                <span>
                  Open position entered {result.open_position.entry_date} at ₹{result.open_position.entry_price} —
                  unrealized {result.open_position.unrealized_pnl_pct >= 0 ? '+' : ''}{result.open_position.unrealized_pnl_pct}%
                </span>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
