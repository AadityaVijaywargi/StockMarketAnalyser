import React from 'react';
import { SearchStock } from './SearchService';
import { SearchResult } from './SearchResult';
import { History, TrendingUp, Search, HelpCircle, Sparkles } from 'lucide-react';

interface SearchDropdownProps {
  query: string;
  results: SearchStock[];
  recentSearches: string[];
  popularStocks: SearchStock[];
  activeIndex: number;
  onSelectStock: (stock: SearchStock) => void;
  setActiveIndex: (index: number) => void;
  onClearRecent?: () => void;
}

export const SearchDropdown: React.FC<SearchDropdownProps> = ({
  query,
  results,
  recentSearches,
  popularStocks,
  activeIndex,
  onSelectStock,
  setActiveIndex,
  onClearRecent
}) => {
  const showRecent = !query && recentSearches.length > 0;
  const showPopular = !query;

  const isFuzzyState = results.length > 0 && results[0].isFuzzySuggestion;

  return (
    <div className="absolute top-full left-0 right-0 mt-2 bg-surface border border-borderDark/80 rounded-2xl shadow-premium z-50 overflow-hidden font-sans p-2 flex flex-col gap-3">
      
      {/* 1. Fuzzy Matches Header banner ("Did You Mean...?") */}
      {query && isFuzzyState && (
        <div className="px-3 py-2 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-center gap-2 text-xs font-mono text-amber-300">
          <HelpCircle className="w-4 h-4 text-amber-400 shrink-0" />
          <span>No exact match found for "{query}". Did you mean...</span>
        </div>
      )}

      {/* 2. Search Results List */}
      {query && results.length > 0 && (
        <div className="flex flex-col gap-1 max-h-[320px] overflow-y-auto pr-1">
          <div className="text-[10px] font-bold font-mono tracking-wider text-textMuted uppercase px-3 py-1 flex items-center justify-between border-b border-borderDark/40 mb-1">
            <div className="flex items-center gap-1.5">
              <Search className="w-3 h-3 text-brand" />
              <span>{isFuzzyState ? 'Fuzzy Suggestions' : 'Search Results'}</span>
            </div>
            <span className="text-[9px] text-textMuted">{results.length} Found</span>
          </div>

          {results.map((stock, idx) => (
            <SearchResult
              key={stock.ticker}
              stock={stock}
              isActive={idx === activeIndex}
              query={query}
              onClick={() => onSelectStock(stock)}
              onMouseEnter={() => setActiveIndex(idx)}
            />
          ))}
        </div>
      )}

      {/* 3. Empty Query - Popular Assets */}
      {showPopular && (
        <div className="flex flex-col gap-2 p-2">
          <div className="text-[10px] font-bold font-mono tracking-wider text-textMuted uppercase flex items-center gap-1.5 border-b border-borderDark/40 pb-1.5 mb-1">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
            <span>Popular & Trending Assets</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {popularStocks.map(stock => {
              const base = stock.ticker.split('.')[0];
              return (
                <button
                  key={stock.ticker}
                  onClick={() => onSelectStock(stock)}
                  className="p-2.5 rounded-xl border border-borderDark/60 bg-background/80 hover:bg-brand/10 hover:border-brand/30 hover:text-white transition-all text-xs font-mono font-bold text-center text-slate-300"
                >
                  <div>{base}</div>
                  <span className="text-[9px] text-textMuted font-normal block truncate">{stock.sector}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 4. Empty Query - Recent Searches */}
      {showRecent && (
        <div className="flex flex-col gap-2 p-2 border-t border-borderDark/30 pt-3">
          <div className="text-[10px] font-bold font-mono tracking-wider text-textMuted uppercase flex items-center justify-between gap-1.5">
            <div className="flex items-center gap-1.5">
              <History className="w-3.5 h-3.5 text-brand" />
              <span>Recent Searches</span>
            </div>
            {onClearRecent && (
              <button
                onClick={onClearRecent}
                className="text-[9px] text-rose-400 hover:underline font-mono uppercase cursor-pointer"
              >
                Clear
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-2 mt-1">
            {recentSearches.map(ticker => {
              const base = ticker.split('.')[0];
              return (
                <button
                  key={ticker}
                  onClick={() => onSelectStock({ ticker, name: base, exchange: 'NSE' })}
                  className="px-3 py-1.5 rounded-lg border border-borderDark/50 bg-background/80 hover:bg-surface text-xs font-mono text-slate-200 hover:text-white transition-all cursor-pointer"
                >
                  {base}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 5. Complete No Matches Found State */}
      {query && results.length === 0 && (
        <div className="p-4 text-left text-xs text-textMuted flex flex-col gap-2.5 bg-background/40 rounded-xl border border-borderDark/60">
          <div className="flex items-center gap-2 text-rose-400 font-mono font-bold border-b border-borderDark/60 pb-2">
            <Search className="w-4 h-4 shrink-0" />
            <span>No matching security found.</span>
          </div>

          <div className="space-y-1.5 text-[11px] font-sans text-slate-300 pt-0.5">
            <span className="font-mono text-[10px] text-textMuted uppercase font-bold block mb-1">Search Suggestions:</span>
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-brand shrink-0" />
              <span>Check spelling of ticker or company name</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-brand shrink-0" />
              <span>Search by company name (e.g. "Tata Consultancy")</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-brand shrink-0" />
              <span>Search by ticker symbol (e.g. "TCS" or "INFY")</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-brand shrink-0" />
              <span>Try searching with fewer or broader words</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
