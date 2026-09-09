import React, { useState, useEffect } from 'react';
import { TopOpportunityCard } from '../../types';
import { apiService } from '../../services/api';
import { OpportunityCard } from './OpportunityCard';
import { Sparkles, Filter, RefreshCw, AlertCircle, Compass } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface TopOpportunitiesSectionProps {
  onSelectStock: (ticker: string) => void;
}

export const TopOpportunitiesSection: React.FC<TopOpportunitiesSectionProps> = ({ onSelectStock }) => {
  const [opportunities, setOpportunities] = useState<TopOpportunityCard[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [isComputing, setIsComputing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Filters state
  const [selectedRec, setSelectedRec] = useState<string>('ALL');
  const [selectedSector, setSelectedSector] = useState<string>('ALL');

  const fetchOpportunities = async (forceRefresh = false) => {
    if (forceRefresh) setIsRefreshing(true);
    else setIsLoading(true);

    setError(null);

    try {
      const data = await apiService.getTopOpportunities(12, forceRefresh);
      setOpportunities(data.opportunities || []);
      setIsComputing(!!data.computing);
    } catch (err: any) {
      console.error("Failed to load top opportunities:", err);
      setError("Unable to load top market opportunities right now.");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  // Silent poll - used while a background scan is in flight, so it
  // shouldn't flip the skeleton-loader or refresh-spinner states.
  const pollOpportunities = async () => {
    try {
      const data = await apiService.getTopOpportunities(12, false);
      setOpportunities(data.opportunities || []);
      setIsComputing(!!data.computing);
    } catch {
      // Stay quiet - the next poll (or a manual refresh) will retry.
    }
  };

  useEffect(() => {
    fetchOpportunities();
  }, []);

  // The scan now runs in the background on the server (a synchronous
  // request used to reliably time out) - while `computing` comes back
  // true, poll every few seconds so the feed fills in as soon as the
  // server-side scan finishes, without the user needing to hit Refresh.
  useEffect(() => {
    if (!isComputing) return;
    const timer = setTimeout(pollOpportunities, 5000);
    return () => clearTimeout(timer);
  }, [isComputing]);

  // Filter logic
  const filteredCards = opportunities.filter(card => {
    const matchesRec = selectedRec === 'ALL' || card.recommendation === selectedRec;
    const matchesSector = selectedSector === 'ALL' || card.sector === selectedSector;
    return matchesRec && matchesSector;
  });

  // Extract unique sectors list
  const uniqueSectors = Array.from(new Set(opportunities.map(c => c.sector))).filter(Boolean);

  return (
    <section className="w-full max-w-7xl mx-auto px-6 py-12 flex flex-col gap-8 font-sans">
      
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-borderDark/50 pb-6">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-brand/10 text-brand border border-brand/20">
              <Sparkles className="w-5 h-5" />
            </span>
            <span className="text-xs font-mono font-bold uppercase tracking-widest text-brand">
              Quantitative Scanner Feed
            </span>
          </div>
          <h2 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
            Top Stock Opportunities
          </h2>
          <p className="text-sm text-textMuted max-w-xl">
            Live deterministic signals scanned across liquid NSE market assets. Sorted by overall quantitative model score.
          </p>
        </div>

        {/* Refresh Button */}
        <button
          onClick={() => fetchOpportunities(true)}
          disabled={isLoading || isRefreshing}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-surface border border-borderDark/80 hover:border-brand/40 text-xs font-mono text-textMuted hover:text-white transition-all shadow-premium disabled:opacity-50 self-start md:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-brand' : ''}`} />
          <span>{isRefreshing ? 'Rescanning Market...' : 'Refresh Feed'}</span>
        </button>
      </div>

      {/* Filter Control Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-surface/60 border border-borderDark/60 p-3 rounded-2xl backdrop-blur-md">
        
        {/* Recommendation Filter Pills */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs font-mono text-textMuted mr-2 flex items-center gap-1">
            <Filter className="w-3.5 h-3.5 text-brand" /> Filter Signal:
          </span>

          {['ALL', 'BUY', 'WATCH', 'AVOID'].map(rec => (
            <button
              key={rec}
              onClick={() => setSelectedRec(rec)}
              className={`px-3 py-1.5 rounded-xl text-xs font-mono font-semibold transition-all ${
                selectedRec === rec
                  ? 'bg-brand text-black font-bold shadow-md'
                  : 'bg-white/[0.02] text-textMuted hover:text-white border border-borderDark/40 hover:border-borderDark'
              }`}
            >
              {rec === 'ALL' ? 'All Signals' : rec}
            </button>
          ))}
        </div>

        {/* Sector Dropdown Filter */}
        {uniqueSectors.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-textMuted">Sector:</span>
            <select
              value={selectedSector}
              onChange={(e) => setSelectedSector(e.target.value)}
              className="bg-surface border border-borderDark/80 rounded-xl px-3 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-brand transition-all cursor-pointer"
            >
              <option value="ALL">All Sectors ({opportunities.length})</option>
              {uniqueSectors.map(sec => (
                <option key={sec} value={sec}>{sec}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Main Content Area */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map(n => (
            <div key={n} className="bg-surface/50 border border-borderDark/40 rounded-2xl p-6 h-64 animate-pulse flex flex-col justify-between" />
          ))}
        </div>
      ) : error ? (
        <div className="p-8 rounded-2xl bg-surface/80 border border-bearish/30 text-center flex flex-col items-center gap-3 text-bearish">
          <AlertCircle className="w-8 h-8" />
          <span className="text-sm font-semibold">{error}</span>
          <button
            onClick={() => fetchOpportunities(true)}
            className="px-4 py-2 rounded-xl bg-bearish/10 border border-bearish/40 text-xs font-mono text-white hover:bg-bearish/20 transition-all"
          >
            Retry Fetching Opportunities
          </button>
        </div>
      ) : opportunities.length === 0 && isComputing ? (
        /* First-ever scan still running in the background on the server -
           distinct from "genuinely found nothing" below, since that would
           otherwise look like a real (if unlikely) result. */
        <div className="p-12 rounded-2xl bg-surface/50 border border-borderDark/60 text-center flex flex-col items-center justify-center gap-3">
          <RefreshCw className="w-10 h-10 text-brand animate-spin" />
          <h4 className="text-base font-bold text-white">Scanning the market...</h4>
          <p className="text-xs text-textMuted max-w-md">
            First scan of the session - this refreshes automatically in a few seconds.
          </p>
        </div>
      ) : filteredCards.length === 0 ? (
        /* Empty State Fallback */
        <div className="p-12 rounded-2xl bg-surface/50 border border-borderDark/60 text-center flex flex-col items-center justify-center gap-3">
          <Compass className="w-10 h-10 text-borderDark animate-bounce" />
          <h4 className="text-base font-bold text-white">No strong opportunities detected right now.</h4>
          <p className="text-xs text-textMuted max-w-md">
            No stock matches your active filter options ({selectedRec !== 'ALL' ? selectedRec : ''} {selectedSector !== 'ALL' ? selectedSector : ''}).
          </p>
          <button
            onClick={() => { setSelectedRec('ALL'); setSelectedSector('ALL'); }}
            className="mt-2 px-4 py-2 rounded-xl bg-brand/10 border border-brand/30 text-xs font-mono text-brand font-bold hover:bg-brand hover:text-black transition-all"
          >
            Reset Filters
          </button>
        </div>
      ) : (
        /* Grid Display of Cards */
        <AnimatePresence mode="popLayout">
          <motion.div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCards.map(card => (
              <OpportunityCard
                key={card.ticker}
                card={card}
                onClick={onSelectStock}
              />
            ))}
          </motion.div>
        </AnimatePresence>
      )}

    </section>
  );
};
