import React from 'react';
import { SearchStock } from './SearchService';
import { SearchResult } from './SearchResult';
import { History, TrendingUp, Search } from 'lucide-react';

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

  return (
    <div className="absolute top-full left-0 right-0 mt-2 bg-surface border border-borderDark/80 rounded-2xl shadow-premium z-50 overflow-hidden font-sans p-2 flex flex-col gap-4">
      {/* 1. Autocomplete Search Results */}
      {query && results.length > 0 && (
        <div className="flex flex-col gap-1 max-h-[280px] overflow-y-auto pr-1">
          <div className="text-[10px] font-bold font-mono tracking-wider text-textMuted uppercase px-3 py-1.5 flex items-center gap-1.5 border-b border-borderDark/40 mb-1">
            <Search className="w-3 h-3 text-brand" />
            <span>Search Results</span>
          </div>
          {results.map((stock, idx) => (
            <SearchResult
              key={stock.ticker}
              stock={stock}
              isActive={idx === activeIndex}
              onClick={() => onSelectStock(stock)}
              onMouseEnter={() => setActiveIndex(idx)}
            />
          ))}
        </div>
      )}

      {/* 2. Empty Query - Popular Stocks */}
      {showPopular && (
        <div className="flex flex-col gap-2 p-2">
          <div className="text-[10px] font-bold font-mono tracking-wider text-textMuted uppercase flex items-center gap-1.5 border-b border-borderDark/40 pb-1.5 mb-1">
            <TrendingUp className="w-3.5 h-3.5 text-bullish" />
            <span>Popular Assets</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {popularStocks.map(stock => {
              const base = stock.ticker.split('.')[0];
              return (
                <button
                  key={stock.ticker}
                  onClick={() => onSelectStock(stock)}
                  className="p-2.5 rounded-xl border border-borderDark/60 bg-white/[0.01] hover:bg-brand/10 hover:border-brand/20 hover:text-white transition-all text-xs font-mono font-bold text-center text-textMuted"
                >
                  {base}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 3. Empty Query - Recent Searches */}
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
                className="text-[9px] text-bearish hover:underline font-mono uppercase"
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
                  onClick={() => onSelectStock({ ticker, name: '', exchange: 'NSE' })}
                  className="px-3 py-1.5 rounded-lg border border-borderDark/40 bg-white/[0.01] hover:bg-white/[0.04] text-xs font-mono text-white transition-all"
                >
                  {base}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 4. No matches found state */}
      {query && results.length === 0 && (
        <div className="p-8 text-center text-xs text-textMuted flex flex-col items-center justify-center gap-2">
          <Search className="w-8 h-8 text-borderDark animate-pulse" />
          <div>
            <span className="text-white font-bold block">No Assets Found</span>
            <span className="text-[10px]">No matches for "{query}". Check spelling or exchange suffix.</span>
          </div>
        </div>
      )}
    </div>
  );
};
