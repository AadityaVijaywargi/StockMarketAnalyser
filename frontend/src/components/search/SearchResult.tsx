import React from 'react';
import { SearchStock } from './SearchService';
import { Star, TrendingUp, TrendingDown, Sparkles } from 'lucide-react';
import { useWatchlist } from '../../context/WatchlistContext';

interface SearchResultProps {
  stock: SearchStock;
  isActive: boolean;
  query?: string;
  onClick: () => void;
  onMouseEnter: () => void;
}

// Utility: Highlight matching text snippet
const HighlightText: React.FC<{ text: string; query?: string }> = ({ text, query }) => {
  if (!query || !query.trim()) return <span>{text}</span>;
  const parts = text.split(new RegExp(`(${query.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));

  return (
    <span>
      {parts.map((part, i) =>
        part.toLowerCase() === query.trim().toLowerCase() ? (
          <mark key={i} className="bg-brand/30 text-white rounded px-0.5 font-bold">
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </span>
  );
};

export const SearchResult: React.FC<SearchResultProps> = ({
  stock,
  isActive,
  query,
  onClick,
  onMouseEnter
}) => {
  const { isFavorite } = useWatchlist();
  const isFav = isFavorite(stock.ticker);
  const tickerBase = stock.ticker.split('.')[0];

  return (
    <div
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      className={`flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all duration-200 font-sans border ${
        isActive
          ? 'bg-brand/15 border-brand/40 text-white shadow-premium'
          : 'bg-background/60 hover:bg-surface border-borderDark/60 text-slate-200 hover:text-white'
      }`}
    >
      <div className="flex items-center gap-3 min-w-0">
        {/* Sleek Ticker Avatar Box */}
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-xs font-mono font-bold shrink-0 border ${
          stock.exchange === 'INDEX'
            ? 'bg-purple-500/20 border-purple-500/40 text-purple-300'
            : isActive 
            ? 'bg-brand/30 border-brand/50 text-white' 
            : 'bg-surfaceDark border-borderDark text-slate-300'
        }`}>
          {tickerBase.slice(0, 3)}
        </div>

        <div className="flex flex-col gap-0.5 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm text-white font-mono tracking-wide">
              <HighlightText text={tickerBase} query={query} />
            </span>

            <span className={`text-[9px] px-1.5 py-0.5 rounded font-mono font-bold border uppercase ${
              stock.exchange === 'INDEX'
                ? 'bg-purple-500/15 border-purple-500/30 text-purple-300'
                : 'bg-white/[0.04] border-borderDark text-textMuted'
            }`}>
              {stock.exchange}
            </span>

            {isFav && (
              <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400 shrink-0" />
            )}
          </div>

          <span className="text-xs text-slate-300 truncate">
            <HighlightText text={stock.name} query={query} />
          </span>
        </div>
      </div>

      {/* Sector Badge / Exchange Meta */}
      <div className="flex flex-col items-end gap-1 text-right shrink-0 ml-3 font-mono">
        {stock.sector ? (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/[0.03] border border-borderDark/60 text-slate-400 truncate max-w-[130px]">
            {stock.sector}
          </span>
        ) : (
          <span className="text-[10px] text-textMuted uppercase">{stock.exchange}</span>
        )}
      </div>
    </div>
  );
};
