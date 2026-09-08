import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Star, Search, Trash2, ArrowUpDown, Clock, TrendingUp, TrendingDown, ChevronRight, Activity, ExternalLink, X } from 'lucide-react';
import { WatchlistItem, LiveQuote, PredictionResult, PredictionTrend } from '../types';
import { useWatchlist } from '../context/WatchlistContext';
import { watchlistMonitorService, WATCHLIST_MONITOR_UPDATED_EVENT } from '../services/watchlist_monitor_service';
import { TopNavbar } from '../components/TopNavbar';
import { TechnicalChart } from '../components/TechnicalChart';
import { motion, AnimatePresence } from 'framer-motion';

type SortOption = 'insertion' | 'alphabetical' | 'price' | 'change' | 'recommendation' | 'confidence' | 'newest' | 'oldest';

export const WatchlistPage: React.FC<{ onSearch: (ticker: string) => void; isLoading: boolean }> = ({ onSearch, isLoading }) => {
  const navigate = useNavigate();
  const { watchlist: items, toggleFavorite, clearWatchlist, getMonitorHealth } = useWatchlist();
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortBy, setSortBy] = useState<SortOption>('insertion');
  const [monitoredData, setMonitoredData] = useState<Record<string, any>>({});
  const [showClearModal, setShowClearModal] = useState<boolean>(false);
  const [selectedInlineTicker, setSelectedInlineTicker] = useState<string | null>(null);

  // Subscribe to background WatchlistMonitorService updates
  useEffect(() => {
    const updateFromMonitor = () => {
      const allStates = watchlistMonitorService.getAllMonitoredStates();
      const map: Record<string, any> = {};
      allStates.forEach(s => {
        map[s.ticker.toUpperCase().trim()] = s;
      });
      setMonitoredData(map);
    };

    updateFromMonitor();
    window.addEventListener(WATCHLIST_MONITOR_UPDATED_EVENT, updateFromMonitor);
    return () => window.removeEventListener(WATCHLIST_MONITOR_UPDATED_EVENT, updateFromMonitor);
  }, [items]);

  const monitorHealth = getMonitorHealth();

  const handleRowClick = (ticker: string) => {
    setSelectedInlineTicker(ticker);
  };

  const handleToggleStar = (e: React.MouseEvent, ticker: string) => {
    e.stopPropagation();
    toggleFavorite(ticker);
  };

  const filteredItems = items.filter(item => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      item.ticker.toLowerCase().includes(q) ||
      (item.company_name && item.company_name.toLowerCase().includes(q))
    );
  });

  const sortedItems = [...filteredItems].sort((a, b) => {
    const cleanA = a.ticker.toUpperCase().trim();
    const cleanB = b.ticker.toUpperCase().trim();
    const monA = monitoredData[cleanA];
    const monB = monitoredData[cleanB];

    if (sortBy === 'alphabetical') {
      return a.ticker.localeCompare(b.ticker);
    }
    if (sortBy === 'price') {
      return (monB?.quote?.price || 0) - (monA?.quote?.price || 0);
    }
    if (sortBy === 'change') {
      return (monB?.quote?.change_pct || 0) - (monA?.quote?.change_pct || 0);
    }
    if (sortBy === 'recommendation') {
      return (monB?.probability || 50) - (monA?.probability || 50);
    }
    if (sortBy === 'confidence') {
      return (monB?.confidence || 50) - (monA?.confidence || 50);
    }
    if (sortBy === 'newest') {
      return new Date(b.date_added).getTime() - new Date(a.date_added).getTime();
    }
    if (sortBy === 'oldest') {
      return new Date(a.date_added).getTime() - new Date(b.date_added).getTime();
    }
    return 0;
  });

  return (
    <div className="min-h-screen bg-background text-textMain flex flex-col font-sans">
      <TopNavbar onSearch={onSearch} isLoading={isLoading} />

      <main className="p-6 max-w-[1400px] w-full mx-auto flex flex-col gap-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-borderDark pb-5">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center text-yellow-400">
                <Star className="w-5 h-5 fill-yellow-400" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-white font-mono flex items-center gap-2">
                  <span>Monitored Watchlist</span>
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-brand/10 text-brand border border-brand/20 font-sans">
                    {items.length} {items.length === 1 ? 'Stock' : 'Stocks'}
                  </span>
                </h1>
                <p className="text-xs text-textMuted font-mono">Continuous background monitoring engine active</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 bg-surface border border-borderDark px-4 py-2 rounded-xl text-xs font-mono">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-bullish opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-bullish"></span>
              </span>
              <span className="text-slate-300 font-bold">Monitor: {monitorHealth.status}</span>
            </div>
            <span className="text-borderDark">|</span>
            <span className="text-textMuted">Cache Hit: <strong className="text-brand">{monitorHealth.cache_hit_rate}%</strong></span>
            <span className="text-borderDark">|</span>
            <span className="text-textMuted">Avg: <strong className="text-white">{monitorHealth.avg_refresh_time_ms}ms</strong></span>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-surface p-4 rounded-2xl border border-borderDark">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-textMuted" />
            <input
              type="text"
              placeholder="Search watchlist..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-background border border-borderDark rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-textMuted focus:outline-none focus:border-brand transition-all"
            />
          </div>

          {items.length > 0 && (
            <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
              <div className="flex items-center gap-2">
                <ArrowUpDown className="w-3.5 h-3.5 text-textMuted" />
                <span className="text-xs text-textMuted font-mono hidden sm:inline">Sort:</span>
                <select
                  value={sortBy}
                  onChange={e => setSortBy(e.target.value as SortOption)}
                  className="bg-background border border-borderDark rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-brand cursor-pointer"
                >
                  <option value="insertion" className="bg-surface text-white">Default Order</option>
                  <option value="alphabetical" className="bg-surface text-white">Alphabetical (A-Z)</option>
                  <option value="price" className="bg-surface text-white">Highest Price</option>
                  <option value="change" className="bg-surface text-white">Daily Change %</option>
                  <option value="recommendation" className="bg-surface text-white">Highest Probability</option>
                  <option value="confidence" className="bg-surface text-white">Highest Confidence</option>
                  <option value="newest" className="bg-surface text-white">Newest Added</option>
                  <option value="oldest" className="bg-surface text-white">Oldest Added</option>
                </select>
              </div>
              <button
                onClick={() => setShowClearModal(true)}
                className="flex items-center gap-1.5 bg-bearish/10 hover:bg-bearish/20 text-bearish border border-bearish/30 px-3 py-2 rounded-xl text-xs font-mono font-semibold transition-all"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear All</span>
              </button>
            </div>
          )}
        </div>

        {items.length === 0 ? (
          <div className="bg-surface/50 border border-borderDark/60 rounded-2xl p-12 flex flex-col items-center justify-center text-center gap-4 my-8">
            <div className="w-16 h-16 rounded-2xl bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center text-yellow-400 animate-bounce">
              <Star className="w-8 h-8" />
            </div>
            <div className="flex flex-col gap-1 max-w-md">
              <h3 className="text-lg font-bold text-white font-mono">No stocks in your watchlist yet.</h3>
              <p className="text-xs text-textMuted">Click the ☆ icon on any stock card or analysis header to start building your personalized equity watchlist.</p>
            </div>
            <button
              onClick={() => onSearch('RELIANCE.NS')}
              className="mt-2 bg-brand text-white px-5 py-2 rounded-xl text-xs font-mono font-bold hover:bg-brand/90 transition-all shadow-lg shadow-brand/20"
            >
              Analyze RELIANCE.NS
            </button>
          </div>
        ) : (
          <div className="bg-surface border border-borderDark/60 rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-background/80 border-b border-borderDark/60 text-[11px] font-mono text-textMuted uppercase tracking-wider">
                    <th className="py-3.5 px-4 w-12 text-center">Fav</th>
                    <th className="py-3.5 px-4">Company & Ticker</th>
                    <th className="py-3.5 px-4 text-right">Current Price</th>
                    <th className="py-3.5 px-4 text-right">24h Change</th>
                    <th className="py-3.5 px-4 text-center">Recommendation & Intelligence</th>
                    <th className="py-3.5 px-4 text-right">Target / Stop</th>
                    <th className="py-3.5 px-4 text-center">Prediction Trend</th>
                    <th className="py-3.5 px-4 text-center">Last Refreshed</th>
                    <th className="py-3.5 px-4 w-12"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-borderDark/40 font-sans text-xs">
                  {sortedItems.map(item => {
                    const cleanTicker = item.ticker.toUpperCase().trim();
                    const monState = monitoredData[cleanTicker];
                    const quote = monState?.quote;
                    const price = quote?.price;
                    const changePct = quote?.change_pct;
                    const isPositive = (changePct ?? 0) >= 0;
                    
                    const rec = monState?.recommendation || 'HOLD';
                    const conf = monState?.confidence;
                    const target = monState?.targetPrice;
                    const stop = monState?.stopLoss;
                    const trend = monState?.predictionTrend || 'Stable';
                    const lastUpdated = monState?.lastUpdated || 'Pending...';

                    const recColors: Record<string, string> = {
                      'STRONG BUY': 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 font-bold',
                      'BUY': 'bg-bullish/20 text-bullish border-bullish/40 font-bold',
                      'ACCUMULATE': 'bg-teal-500/20 text-teal-300 border-teal-500/40 font-bold',
                      'HOLD': 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40 font-bold',
                      'REDUCE': 'bg-orange-500/20 text-orange-400 border-orange-500/40 font-bold',
                      'SELL': 'bg-bearish/20 text-bearish border-bearish/40 font-bold',
                      'STRONG SELL': 'bg-rose-600/20 text-rose-400 border-rose-600/40 font-bold',
                    };

                    const trendColors: Record<string, string> = {
                      Improving: 'text-bullish bg-bullish/10 border-bullish/30',
                      Stable: 'text-slate-300 bg-slate-500/10 border-slate-500/30',
                      Weakening: 'text-bearish bg-bearish/10 border-bearish/30',
                    };

                    return (
                      <tr
                        key={item.id}
                        onClick={() => handleRowClick(item.ticker)}
                        className="hover:bg-white/[0.03] cursor-pointer transition-colors group"
                      >
                        <td className="py-4 px-4 text-center" onClick={e => handleToggleStar(e, item.ticker)}>
                          <button className="text-yellow-400 hover:scale-110 transition-transform">
                            <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                          </button>
                        </td>
                        <td className="py-4 px-4">
                          <div className="flex flex-col">
                            <span className="font-bold text-white group-hover:text-brand transition-colors text-sm">{item.company_name}</span>
                            <span className="text-[10px] font-mono text-textMuted">{item.ticker} • {item.exchange}</span>
                          </div>
                        </td>
                        <td className="py-4 px-4 text-right font-mono font-bold text-sm text-white">
                          {price !== undefined ? `₹${price.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '--'}
                        </td>
                        <td className="py-4 px-4 text-right font-mono">
                          {changePct !== undefined ? (
                            <span className={`inline-flex items-center gap-1 font-semibold px-2 py-0.5 rounded-md ${isPositive ? 'bg-bullish/10 text-bullish' : 'bg-bearish/10 text-bearish'}`}>
                              {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                              <span>{isPositive ? '+' : ''}{changePct.toFixed(2)}%</span>
                            </span>
                          ) : <span className="text-textMuted">--</span>}
                        </td>
                        <td className="py-4 px-4 text-center">
                          <span className={`text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full border uppercase tracking-wider ${recColors[rec] || recColors.HOLD}`}>
                            {rec} {conf ? `(${conf}%)` : ''}
                          </span>
                        </td>
                        <td className="py-4 px-4 text-right font-mono text-xs">
                          {target ? (
                            <div className="flex flex-col items-end">
                              <span className="text-bullish font-bold">T: ₹{target}</span>
                              <span className="text-amber-400 font-bold">SL: ₹{stop}</span>
                            </div>
                          ) : <span className="text-textMuted">--</span>}
                        </td>
                        <td className="py-4 px-4 text-center">
                          <span className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider ${trendColors[trend] || trendColors.Stable}`}>
                            {trend === 'Improving' ? '📈 Improving' : trend === 'Weakening' ? '📉 Weakening' : '➡️ Stable'}
                          </span>
                        </td>
                        <td className="py-4 px-4 text-center font-mono text-[10px] text-textMuted">
                          <div className="flex items-center justify-center gap-1">
                            <Clock className="w-3 h-3 text-textMuted" />
                            <span>{lastUpdated}</span>
                          </div>
                        </td>
                        <td className="py-4 px-4 text-right">
                          <ChevronRight className="w-4 h-4 text-textMuted group-hover:text-white group-hover:translate-x-1 transition-all" />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      <AnimatePresence>
        {showClearModal && (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-surface border border-borderDark p-6 rounded-2xl max-w-md w-full flex flex-col gap-4 shadow-2xl"
            >
              <div className="flex items-center gap-3 text-bearish">
                <Trash2 className="w-6 h-6" />
                <h3 className="text-lg font-bold text-white font-mono">Clear Entire Watchlist?</h3>
              </div>
              <p className="text-xs text-textMuted">This will remove all {items.length} saved stocks from your watchlist. This action cannot be undone.</p>
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  onClick={() => setShowClearModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-mono font-bold text-textMuted hover:text-white hover:bg-white/5 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    clearWatchlist();
                    setShowClearModal(false);
                  }}
                  className="bg-bearish text-white px-4 py-2 rounded-xl text-xs font-mono font-bold hover:bg-bearish/90 transition-all shadow-lg shadow-bearish/20"
                >
                  Clear Watchlist
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Slide-Over Inline Workspace Drawer */}
        {selectedInlineTicker && (
          <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex justify-end">
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 250 }}
              className="w-full max-w-4xl bg-background border-l border-borderDark h-full flex flex-col shadow-2xl overflow-y-auto p-6 gap-6"
            >
              {/* Drawer Header Toolbar */}
              <div className="flex items-center justify-between border-b border-borderDark pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-brand/10 border border-brand/20 flex items-center justify-center text-brand font-mono font-bold text-sm">
                    {selectedInlineTicker.slice(0, 3)}
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white font-mono flex items-center gap-2">
                      <span>{selectedInlineTicker}</span>
                      {monitoredData[selectedInlineTicker]?.recommendation && (
                        <span className="text-xs px-2.5 py-0.5 rounded-full font-mono font-bold bg-brand/15 text-brand border border-brand/30">
                          {monitoredData[selectedInlineTicker].recommendation}
                        </span>
                      )}
                    </h2>
                    <p className="text-xs text-textMuted font-mono">Live Monitored Stock Workspace</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      onSearch(selectedInlineTicker);
                      navigate(`/dashboard/${selectedInlineTicker.toUpperCase()}`);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-brand text-white text-xs font-mono font-bold hover:bg-brand/90 transition-all shadow-md"
                  >
                    <span>Full Dashboard</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => setSelectedInlineTicker(null)}
                    className="p-2 rounded-xl bg-surface border border-borderDark text-textMuted hover:text-white transition-all"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Technical Chart Workspace */}
              <TechnicalChart
                chartData={{ dates: [], open: [], high: [], low: [], close: [], volume: [] }}
                ticker={selectedInlineTicker}
                prediction={monitoredData[selectedInlineTicker]?.prediction}
              />
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default WatchlistPage;
