import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Loader2, AlertCircle, Star, List, X } from 'lucide-react';
import { apiService } from '../services/api';
import { DeterministicAnalysisReport } from '../types';
import { TechnicalChart } from '../components/TechnicalChart';
import { useWatchlist } from '../context/WatchlistContext';
import { SearchBar } from '../components/search/SearchBar';

const WATCHLIST_PANEL_OPEN_KEY = 'stonks_chartpage_watchlist_open';

// Reserve space for the top nav bar and this page's own compact price
// strip, so the chart gets everything else - the point of this page is
// that the chart IS the workspace, not one card in a long scroll.
const CHROME_HEIGHT_PX = 190;
const MIN_CHART_HEIGHT_PX = 480;

export const ChartPage: React.FC = () => {
  const { ticker: rawTicker } = useParams<{ ticker: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { watchlist, isFavorite, toggleFavorite } = useWatchlist();
  const [isWatchlistPanelOpen, setIsWatchlistPanelOpen] = useState<boolean>(() => {
    try {
      return localStorage.getItem(WATCHLIST_PANEL_OPEN_KEY) === 'true';
    } catch {
      return false;
    }
  });

  const toggleWatchlistPanel = () => {
    setIsWatchlistPanelOpen(prev => {
      const next = !prev;
      try { localStorage.setItem(WATCHLIST_PANEL_OPEN_KEY, String(next)); } catch {}
      return next;
    });
  };

  // On mobile the watchlist panel becomes a full-screen overlay instead of a
  // side-by-side column - a fixed 224px panel next to the chart on a ~375px
  // viewport squeezes the chart down to nothing. Decided via matchMedia
  // rather than a Tailwind `lg:` class override: that pattern silently broke
  // the sidebar's desktop/mobile switch in the actual Vercel production
  // build earlier despite working in every local test - not trusting it
  // again for anything layout-critical.
  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(min-width: 1024px)').matches : true
  );
  useEffect(() => {
    const mql = window.matchMedia('(min-width: 1024px)');
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  const ticker = (rawTicker || 'RELIANCE.NS').toUpperCase();
  const activeTimeframe = searchParams.get('timeframe') || '1D';

  const [report, setReport] = useState<DeterministicAnalysisReport | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [chartHeight, setChartHeight] = useState<number>(() =>
    Math.max(MIN_CHART_HEIGHT_PX, window.innerHeight - CHROME_HEIGHT_PX)
  );

  useEffect(() => {
    const handleResize = () => {
      setChartHeight(Math.max(MIN_CHART_HEIGHT_PX, window.innerHeight - CHROME_HEIGHT_PX));
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);
    setError(null);
    apiService.analyzeTicker(ticker)
      .then(data => {
        if (isMounted) setReport(data);
      })
      .catch(err => {
        if (isMounted) setError(err?.response?.data?.detail || `Unable to load chart data for ${ticker}.`);
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });
    return () => { isMounted = false; };
  }, [ticker]);

  const handleTimeframeChange = (tf: string) => {
    setSearchParams({ timeframe: tf });
  };

  const handleSwitchTicker = (newTicker: string) => {
    const clean = newTicker.toUpperCase().trim();
    if (clean && clean !== ticker) {
      navigate(`/chart/${clean}?timeframe=${activeTimeframe}`);
    }
  };

  const favorite = isFavorite(ticker);
  // A ticker with fewer than 2 close prices (e.g. a stock newly listed
  // with limited history) left this dividing by close[-2] === undefined,
  // rendering "NaN%" in the price strip instead of just omitting change.
  const closes = report?.chart_data.close || [];
  const changePct = closes.length >= 2 && closes[closes.length - 2] > 0
    ? ((closes[closes.length - 1] - closes[closes.length - 2]) / closes[closes.length - 2]) * 100
    : 0;
  const lastPrice = report?.chart_data.close[report.chart_data.close.length - 1];

  return (
    <div className="h-screen flex flex-col bg-background text-text font-sans overflow-hidden">

      {/* Compact Price Strip - deliberately minimal, this page is the chart */}
      <div className="shrink-0 border-b border-borderDark bg-surface px-4 sm:px-6 py-3 flex flex-wrap items-center gap-3 sm:gap-5">
        <button
          onClick={() => navigate(`/dashboard/${ticker}`)}
          aria-label="Back to dashboard"
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-textMuted hover:text-white hover:bg-white/[0.05] text-xs font-mono font-semibold transition-all"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Dashboard</span>
        </button>

        <div className="h-6 w-px bg-borderDark hidden sm:block" />

        <div className="flex items-center gap-2">
          <h1 className="font-bold text-base sm:text-lg text-white font-mono">{report?.company_name || ticker.split('.')[0]}</h1>
          <span className="text-[10px] text-textMuted font-mono">{ticker}</span>
          <button
            onClick={() => toggleFavorite(ticker, report?.company_name || ticker, lastPrice)}
            aria-label={favorite ? 'Remove from watchlist' : 'Add to watchlist'}
            className="text-textMuted hover:text-amber-400 transition-colors"
          >
            <Star className={`w-4 h-4 ${favorite ? 'fill-amber-400 text-amber-400' : ''}`} />
          </button>
        </div>

        {lastPrice !== undefined && (
          <div className="flex items-center gap-2 font-mono">
            <span className="text-lg font-extrabold text-white">₹{lastPrice.toLocaleString('en-IN')}</span>
            <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${changePct >= 0 ? 'text-emerald-400 bg-emerald-500/10' : 'text-rose-400 bg-rose-500/10'}`}>
              {changePct >= 0 ? '+' : ''}{changePct.toFixed(2)}%
            </span>
          </div>
        )}

        {report?.scores?.recommendation && (
          <span className="text-[11px] font-mono font-bold px-2.5 py-1 rounded-lg bg-brand/15 border border-brand/30 text-brand">
            {report.scores.recommendation}
          </span>
        )}

        <div className="w-full sm:w-64 order-last sm:order-none sm:ml-auto">
          <SearchBar
            onSearch={handleSwitchTicker}
            placeholder="Switch symbol..."
            compact
            className="w-full"
          />
        </div>

        <button
          onClick={toggleWatchlistPanel}
          aria-label={isWatchlistPanelOpen ? 'Hide watchlist' : 'Show watchlist'}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-mono font-semibold transition-all ${
            isWatchlistPanelOpen
              ? 'bg-brand/15 border-brand/40 text-brand'
              : 'bg-background border-borderDark/60 text-textMuted hover:text-white'
          }`}
          title="Toggle watchlist panel"
        >
          <List className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Watchlist</span>
        </button>
      </div>

      {/* Full-height chart workspace + optional watchlist quick-switch panel */}
      <div className="flex-1 min-h-0 flex overflow-hidden">
        <div className="flex-1 min-w-0 overflow-y-auto p-3 sm:p-4">
          {isLoading && (
            <div className="h-full flex flex-col items-center justify-center gap-3 text-textMuted">
              <Loader2 className="w-7 h-7 animate-spin text-brand" />
              <span className="font-mono text-xs font-bold">Loading {ticker} chart workspace...</span>
            </div>
          )}

          {error && !isLoading && (
            <div className="h-full flex flex-col items-center justify-center gap-3">
              <AlertCircle className="w-8 h-8 text-rose-400" />
              <span className="font-mono text-xs text-rose-400 font-bold">{error}</span>
            </div>
          )}

          {report && !isLoading && !error && (
            <TechnicalChart
              chartData={report.chart_data}
              ticker={ticker}
              prediction={report.prediction}
              tradeSignal={report.trade_signal}
              activeTimeframe={activeTimeframe}
              onTimeframeChange={handleTimeframeChange}
              mainHeight={chartHeight}
            />
          )}
        </div>

        {isWatchlistPanelOpen && !isDesktop && (
          <div
            onClick={toggleWatchlistPanel}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
          />
        )}

        {isWatchlistPanelOpen && (
          <div
            className={
              isDesktop
                ? 'w-56 shrink-0 border-l border-borderDark bg-surface flex flex-col'
                : 'fixed inset-y-0 right-0 z-50 w-64 max-w-[80vw] border-l border-borderDark bg-surface flex flex-col shadow-2xl'
            }
          >
            <div className="flex items-center justify-between p-3 border-b border-borderDark/60">
              <span className="text-xs font-mono font-bold text-white">Watchlist ({watchlist.length})</span>
              <button
                onClick={toggleWatchlistPanel}
                aria-label="Close watchlist panel"
                className="text-textMuted hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {watchlist.length === 0 ? (
                <div className="p-4 text-center text-[11px] text-textMuted font-mono">
                  No stocks watched yet. Click the star next to a symbol to add one.
                </div>
              ) : (
                watchlist.map(item => {
                  const clean = item.ticker.toUpperCase().trim();
                  const isActive = clean === ticker;
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleSwitchTicker(clean)}
                      className={`w-full text-left px-3 py-2.5 border-b border-borderDark/30 transition-all ${
                        isActive ? 'bg-brand/10 border-l-2 border-l-brand' : 'hover:bg-white/[0.03]'
                      }`}
                    >
                      <div className={`text-xs font-mono font-bold ${isActive ? 'text-brand' : 'text-white'}`}>
                        {item.company_name || clean.split('.')[0]}
                      </div>
                      <div className="text-[10px] text-textMuted font-mono">{clean}</div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
