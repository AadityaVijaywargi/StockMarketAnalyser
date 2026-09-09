import React, { useState, useEffect } from 'react';
import { TopNavbar } from '../components/TopNavbar';
import { apiService } from '../services/api';
import { watchlistService, WATCHLIST_UPDATED_EVENT } from '../services/watchlist_service';
import { watchlistMonitorService, WATCHLIST_MONITOR_UPDATED_EVENT } from '../services/watchlist_monitor_service';
import { 
  Sparkles, 
  Activity, 
  TrendingUp, 
  TrendingDown, 
  ShieldAlert, 
  Globe, 
  Layers, 
  Target, 
  Zap,
  BarChart2,
  RefreshCw,
  Star,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';
import { motion } from 'framer-motion';

interface MarketOverviewPageProps {
  onSearch: (ticker: string) => void;
  isLoading: boolean;
}

export const MarketOverviewPage: React.FC<MarketOverviewPageProps> = ({ onSearch, isLoading }) => {
  const [data, setData] = useState<any>(null);
  const [loadingData, setLoadingData] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'BUY' | 'WATCH' | 'AVOID'>('BUY');
  const [watchlistSummary, setWatchlistSummary] = useState<any>(null);

  const fetchOverview = async (forceRefresh: boolean = false) => {
    setLoadingData(true);
    try {
      const res = await apiService.getMarketOverview(forceRefresh);
      setData(res);
    } catch (err) {
      console.error("Failed to load market overview:", err);
    } finally {
      setLoadingData(false);
    }
  };

  // Uses the same live monitored state WatchlistPage reads from (real
  // quotes + real model recommendations from watchlistMonitorService),
  // instead of fabricating counts/performers from the item's list index -
  // this panel used to show a fake "+2.45% best performer" for every user
  // regardless of what was actually in their watchlist.
  const computeWatchlistSummary = () => {
    const items = watchlistService.getWatchlist();
    if (!items.length) {
      setWatchlistSummary(null);
      return;
    }

    const monitored = watchlistMonitorService.getAllMonitoredStates();
    const monitorByTicker: Record<string, any> = {};
    monitored.forEach(s => { monitorByTicker[s.ticker.toUpperCase().trim()] = s; });

    const bullishRecs = ['STRONG BUY', 'BUY', 'ACCUMULATE'];
    const bearishRecs = ['REDUCE', 'SELL', 'STRONG SELL'];

    let bullishCount = 0;
    let neutralCount = 0;
    let bearishCount = 0;
    let best: { ticker: string; change: number } | null = null;
    let worst: { ticker: string; change: number } | null = null;

    items.forEach(item => {
      const state = monitorByTicker[item.ticker.toUpperCase().trim()];
      const rec = state?.recommendation;
      if (rec && bullishRecs.includes(rec)) bullishCount++;
      else if (rec && bearishRecs.includes(rec)) bearishCount++;
      else neutralCount++;

      const currentPrice = state?.quote?.price;
      if (item.price_at_add && currentPrice) {
        const changePct = ((currentPrice - item.price_at_add) / item.price_at_add) * 100;
        if (!best || changePct > best.change) best = { ticker: item.ticker, change: changePct };
        if (!worst || changePct < worst.change) worst = { ticker: item.ticker, change: changePct };
      }
    });

    setWatchlistSummary({
      total: items.length,
      bullishCount,
      neutralCount,
      bearishCount,
      bestPerformer: best,
      worstPerformer: worst
    });
  };

  useEffect(() => {
    fetchOverview();
    computeWatchlistSummary();

    const handleWatchlistUpdate = () => computeWatchlistSummary();
    window.addEventListener(WATCHLIST_UPDATED_EVENT, handleWatchlistUpdate);
    window.addEventListener(WATCHLIST_MONITOR_UPDATED_EVENT, handleWatchlistUpdate);
    return () => {
      window.removeEventListener(WATCHLIST_UPDATED_EVENT, handleWatchlistUpdate);
      window.removeEventListener(WATCHLIST_MONITOR_UPDATED_EVENT, handleWatchlistUpdate);
    };
  }, []);

  if (loadingData && !data) {
    return (
      <div className="flex-1 bg-background flex flex-col items-center justify-center p-6 min-h-screen">
        <div className="flex items-center gap-3 text-brand font-mono text-sm font-bold">
          <RefreshCw className="w-5 h-5 animate-spin" />
          <span>Generating Market Intelligence Dashboard...</span>
        </div>
      </div>
    );
  }

  const ai = data?.ai_summary || {};
  const health = data?.health_score || {};
  const sectors = data?.sectors || [];
  const buyCandidates = data?.buy_candidates || [];
  const watchCandidates = data?.watch_candidates || [];
  const avoidCandidates = data?.avoid_candidates || [];
  const marketRisks = data?.market_risks || [];

  const activeCandidates = activeTab === 'BUY' ? buyCandidates : activeTab === 'WATCH' ? watchCandidates : avoidCandidates;

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-background text-slate-100 pb-12">
      <TopNavbar onSearch={onSearch} isLoading={isLoading} />

      <main className="p-6 max-w-[1400px] w-full mx-auto flex flex-col gap-6">
        {/* Page Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 pb-2 border-b border-borderDark/80">
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2.5">
              <Globe className="w-6 h-6 text-brand" />
              <span>Market Intelligence Dashboard</span>
            </h1>
            <p className="text-xs text-textMuted mt-1">
              Real-time institutional breadth, market health scoring, sector strength, and risk radar.
            </p>
          </div>

          <button
            onClick={() => fetchOverview(true)}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-surface border border-borderDark text-xs font-mono text-slate-300 hover:text-white hover:border-brand/40 transition-all cursor-pointer shadow-sm"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingData ? 'animate-spin text-brand' : ''}`} />
            <span>Refresh Intelligence</span>
          </button>
        </div>

        {/* 1. HERO CARD: AI MARKET SUMMARY */}
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-surface border border-brand/30 rounded-2xl p-6 shadow-premium relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-80 h-80 bg-brand/10 rounded-full blur-3xl pointer-events-none" />

          <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pb-3 border-b border-borderDark/80">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-brand/15 border border-brand/30 text-brand">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-xs font-bold font-mono uppercase tracking-widest text-brand">AI Market Executive Summary</h2>
                <span className="text-[10px] text-textMuted font-mono">Updated: {new Date().toLocaleTimeString()}</span>
              </div>
            </div>

            <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/40 text-emerald-400 font-bold text-xs shadow-sm">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Overall Sentiment: {ai.overall_sentiment || 'NEUTRAL'}</span>
            </div>
          </div>

          {/* Concise 3-5 sentence summary */}
          <p className="text-sm text-slate-200 leading-relaxed font-sans mb-6 bg-background/60 border border-borderDark/60 p-4 rounded-xl">
            {ai.concise_summary}
          </p>

          {/* Key Drivers, Strong/Weak Sectors, Risks */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-background/80 border border-borderDark/80 p-3.5 rounded-xl">
              <span className="text-[10px] font-bold font-mono text-brand uppercase block mb-1.5">Key Market Drivers</span>
              <ul className="space-y-1 text-xs text-slate-300">
                {ai.key_drivers?.map((d: string, i: number) => (
                  <li key={i} className="flex items-start gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-brand shrink-0 mt-0.5" />
                    <span>{d}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-background/80 border border-borderDark/80 p-3.5 rounded-xl">
              <span className="text-[10px] font-bold font-mono text-emerald-400 uppercase block mb-1.5">Strongest Sectors</span>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {ai.strong_sectors?.map((s: string, i: number) => (
                  <span key={i} className="px-2 py-1 rounded bg-emerald-500/15 text-emerald-300 font-mono text-[11px] font-bold border border-emerald-500/30">
                    {s}
                  </span>
                ))}
              </div>
            </div>

            <div className="bg-background/80 border border-borderDark/80 p-3.5 rounded-xl">
              <span className="text-[10px] font-bold font-mono text-rose-400 uppercase block mb-1.5">Weakest Sectors</span>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {ai.weak_sectors?.map((s: string, i: number) => (
                  <span key={i} className="px-2 py-1 rounded bg-rose-500/15 text-rose-300 font-mono text-[11px] font-bold border border-rose-500/30">
                    {s}
                  </span>
                ))}
              </div>
            </div>

            <div className="bg-background/80 border border-borderDark/80 p-3.5 rounded-xl">
              <span className="text-[10px] font-bold font-mono text-amber-400 uppercase block mb-1.5">Primary Risks & Focus</span>
              <ul className="space-y-1 text-xs text-slate-300">
                {ai.primary_risks?.map((r: string, i: number) => (
                  <li key={i} className="flex items-start gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                    <span>{r}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </motion.div>

        {/* 2. MARKET HEALTH SCORE & WATCHLIST SUMMARY GRID */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Market Health Score Panel (2 cols) */}
          <div className="lg:col-span-2 bg-surface border border-borderDark rounded-2xl p-6 shadow-xl flex flex-col justify-between">
            <div className="flex items-center justify-between pb-3 border-b border-borderDark/80 mb-4">
              <div className="flex items-center gap-2.5">
                <Activity className="w-5 h-5 text-emerald-400" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">Market Health Score</h3>
              </div>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-mono text-xs font-bold border border-emerald-500/30">
                {health.status || 'Calculating...'}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
              {/* Overall Score Circle */}
              <div className="flex flex-col items-center justify-center p-4 bg-background/80 rounded-xl border border-borderDark/80 text-center">
                <span className="text-xs font-mono text-textMuted uppercase mb-1">Overall Score</span>
                <div className="text-4xl font-black font-mono text-emerald-400 my-1">
                  {health.overall_score ?? '--'}
                  <span className="text-sm text-textMuted font-normal">/100</span>
                </div>
                <span className="text-[10px] text-slate-400 font-mono">Macro Institutional Index</span>
              </div>

              {/* 6 Component Scores */}
              <div className="md:col-span-2 space-y-2.5 font-mono text-xs">
                {[
                  { label: 'Market Trend', score: health.trend_score ?? 50.0 },
                  { label: 'Market Breadth', score: health.breadth_score ?? 50.0 },
                  { label: 'RSI / MACD Momentum', score: health.momentum_score ?? 50.0 },
                  { label: 'Volatility Stress (Inverse VIX)', score: health.volatility_score ?? 50.0 },
                  { label: 'Sector Strength', score: health.sector_strength_score ?? 50.0 },
                  { label: 'Model Confidence', score: health.model_confidence_score ?? 50.0 }
                ].map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between gap-3">
                    <span className="text-slate-300 w-44 truncate">{item.label}</span>
                    <div className="flex-1 bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-800">
                      <div 
                        className="bg-emerald-500 h-full rounded-full transition-all duration-500" 
                        style={{ width: `${item.score}%` }} 
                      />
                    </div>
                    <span className="w-10 text-right font-bold text-white">{item.score}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 6. WATCHLIST SUMMARY PANEL (1 col) */}
          <div className="bg-surface border border-borderDark rounded-2xl p-6 shadow-xl flex flex-col justify-between">
            <div className="flex items-center justify-between pb-3 border-b border-borderDark/80 mb-4">
              <div className="flex items-center gap-2.5">
                <Star className="w-5 h-5 text-amber-400 fill-amber-400" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">Watchlist Overview</h3>
              </div>
              <span className="text-xs font-mono text-brand font-bold">
                {watchlistSummary ? `${watchlistSummary.total} Saved` : 'No Saved Stocks'}
              </span>
            </div>

            {watchlistSummary ? (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-2 text-center font-mono text-xs">
                  <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
                    <span className="text-[10px] text-emerald-400 block font-bold">Bullish</span>
                    <span className="text-lg font-bold text-emerald-400">{watchlistSummary.bullishCount}</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30">
                    <span className="text-[10px] text-amber-400 block font-bold">Neutral</span>
                    <span className="text-lg font-bold text-amber-400">{watchlistSummary.neutralCount}</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30">
                    <span className="text-[10px] text-rose-400 block font-bold">Bearish</span>
                    <span className="text-lg font-bold text-rose-400">{watchlistSummary.bearishCount}</span>
                  </div>
                </div>

                <div className="space-y-2 text-xs font-mono">
                  <div className="p-2.5 rounded-lg bg-background border border-borderDark/80 flex items-center justify-between">
                    <span className="text-slate-400">Best Performer:</span>
                    {watchlistSummary.bestPerformer ? (
                      <span className="font-bold text-emerald-400">
                        {watchlistSummary.bestPerformer.ticker.replace('.NS', '').replace('.BO', '')} ({watchlistSummary.bestPerformer.change >= 0 ? '+' : ''}{watchlistSummary.bestPerformer.change.toFixed(2)}%)
                      </span>
                    ) : (
                      <span className="text-textMuted">Awaiting live data...</span>
                    )}
                  </div>
                  <div className="p-2.5 rounded-lg bg-background border border-borderDark/80 flex items-center justify-between">
                    <span className="text-slate-400">Worst Performer:</span>
                    {watchlistSummary.worstPerformer ? (
                      <span className="font-bold text-rose-400">
                        {watchlistSummary.worstPerformer.ticker.replace('.NS', '').replace('.BO', '')} ({watchlistSummary.worstPerformer.change >= 0 ? '+' : ''}{watchlistSummary.worstPerformer.change.toFixed(2)}%)
                      </span>
                    ) : (
                      <span className="text-textMuted">Awaiting live data...</span>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-6 text-xs text-textMuted">
                <Star className="w-8 h-8 text-slate-700 mx-auto mb-2" />
                <p>No stocks currently in your watchlist.</p>
                <p className="text-[10px] mt-1 text-brand">Search any ticker and click star to pin.</p>
              </div>
            )}
          </div>
        </div>

        {/* 3. SECTOR PERFORMANCE (SORTED STRONGEST TO WEAKEST) */}
        <div className="bg-surface border border-borderDark rounded-2xl p-6 shadow-xl">
          <div className="flex items-center justify-between pb-3 border-b border-borderDark/80 mb-4">
            <div className="flex items-center gap-2.5">
              <Layers className="w-5 h-5 text-brand" />
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">Sector Relative Strength & Performance</h3>
            </div>
            <span className="text-xs text-textMuted font-mono">{sectors.length} Sectors Sorted by Strength</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
            {sectors.map((sec: any) => {
              const isPositive = sec.daily_change_pct >= 0;
              return (
                <div 
                  key={sec.sector_name}
                  className={`p-3.5 rounded-xl border transition-all ${
                    sec.is_top_3 
                      ? 'bg-emerald-500/10 border-emerald-500/40 shadow-sm' 
                      : sec.is_bottom_3 
                      ? 'bg-rose-500/10 border-rose-500/40' 
                      : 'bg-background/80 border-borderDark/80'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-white truncate">{sec.sector_name}</span>
                    {sec.is_top_3 && (
                      <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-mono text-[9px] font-bold border border-emerald-500/40">
                        TOP 3
                      </span>
                    )}
                    {sec.is_bottom_3 && (
                      <span className="px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-400 font-mono text-[9px] font-bold border border-rose-500/40">
                        BOTTOM 3
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-xs font-mono mb-1">
                    <span className="text-textMuted">Daily:</span>
                    <span className={`font-bold flex items-center gap-1 ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                      <span>{isPositive ? '+' : ''}{sec.daily_change_pct}%</span>
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                    <span>RS vs Nifty:</span>
                    <span className="text-white font-bold">{sec.relative_strength}x</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 4. MARKET OPPORTUNITIES (BUY, WATCH, AVOID TABS) */}
        <div className="bg-surface border border-borderDark rounded-2xl p-6 shadow-xl">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-borderDark/80 mb-4">
            <div className="flex items-center gap-2.5">
              <Target className="w-5 h-5 text-brand" />
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">Scanned Market Opportunities</h3>
            </div>

            {/* Tabs */}
            <div className="flex items-center bg-background border border-borderDark/80 p-1 rounded-xl gap-1">
              <button
                onClick={() => setActiveTab('BUY')}
                className={`px-3 py-1 text-xs font-bold rounded-lg font-mono transition-all cursor-pointer ${
                  activeTab === 'BUY'
                    ? 'bg-emerald-600 text-white shadow-md'
                    : 'text-textMuted hover:text-white'
                }`}
              >
                BUY Candidates ({buyCandidates.length})
              </button>
              <button
                onClick={() => setActiveTab('WATCH')}
                className={`px-3 py-1 text-xs font-bold rounded-lg font-mono transition-all cursor-pointer ${
                  activeTab === 'WATCH'
                    ? 'bg-amber-600 text-white shadow-md'
                    : 'text-textMuted hover:text-white'
                }`}
              >
                WATCH Candidates ({watchCandidates.length})
              </button>
              <button
                onClick={() => setActiveTab('AVOID')}
                className={`px-3 py-1 text-xs font-bold rounded-lg font-mono transition-all cursor-pointer ${
                  activeTab === 'AVOID'
                    ? 'bg-rose-600 text-white shadow-md'
                    : 'text-textMuted hover:text-white'
                }`}
              >
                AVOID Candidates ({avoidCandidates.length})
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeCandidates.map((card: any) => (
              <div 
                key={card.ticker}
                onClick={() => onSearch(card.ticker)}
                className={`p-4 rounded-xl border bg-background/80 hover:bg-surface transition-all cursor-pointer ${
                  activeTab === 'BUY' 
                    ? 'border-emerald-500/30 hover:border-emerald-500/60' 
                    : activeTab === 'WATCH' 
                    ? 'border-amber-500/30 hover:border-amber-500/60' 
                    : 'border-rose-500/30 hover:border-rose-500/60'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <span className="font-mono text-sm font-bold text-white">{card.ticker}</span>
                    <span className="text-[11px] text-textMuted block truncate max-w-[180px]">{card.company_name}</span>
                  </div>
                  <span className={`px-2 py-0.5 rounded font-mono text-xs font-bold border ${
                    card.recommendation === 'BUY'
                      ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                      : card.recommendation === 'AVOID'
                      ? 'bg-rose-500/20 text-rose-400 border-rose-500/40'
                      : 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                  }`}>
                    Score: {card.overall_score}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs font-mono mb-3">
                  <span className="text-white font-bold">₹{card.current_price?.toLocaleString('en-IN')}</span>
                  <span className={card.price_change_pct >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                    {card.price_change_pct >= 0 ? '+' : ''}{card.price_change_pct}%
                  </span>
                </div>

                <div className="text-[11px] text-slate-300 font-sans border-t border-borderDark/60 pt-2 space-y-1">
                  {card.key_highlights?.map((h: string, i: number) => (
                    <div key={i} className="flex items-center gap-1.5 text-textMuted">
                      <span className="w-1 h-1 rounded-full bg-brand" />
                      <span className="truncate">{h}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 5. MARKET RISKS PANEL */}
        <div className="bg-surface border border-borderDark rounded-2xl p-6 shadow-xl">
          <div className="flex items-center gap-2.5 pb-3 border-b border-borderDark/80 mb-4">
            <ShieldAlert className="w-5 h-5 text-amber-400" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Market Risk & Macro Influence Radar</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {marketRisks.map((risk: any, idx: number) => (
              <div key={idx} className="p-4 rounded-xl bg-background/80 border border-borderDark/80 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 font-mono text-[10px] font-bold border border-amber-500/30">
                      {risk.category}
                    </span>
                    <span className={`text-[10px] font-mono font-bold ${
                      risk.severity === 'High' ? 'text-rose-400' : 'text-amber-400'
                    }`}>
                      {risk.severity} Severity
                    </span>
                  </div>

                  <h4 className="text-xs font-bold text-white mb-1.5">{risk.title}</h4>
                  <p className="text-xs text-textMuted leading-relaxed mb-3">{risk.description}</p>
                </div>

                <div className="p-2.5 rounded-lg bg-surface border border-borderDark/60 text-[11px] text-slate-300 font-mono">
                  <span className="text-brand font-bold block mb-0.5">Impact:</span>
                  <span>{risk.impact_note}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
};
export default MarketOverviewPage;
