import React from 'react';
import { SearchStock } from './SearchService';

interface SearchResultProps {
  stock: SearchStock;
  isActive: boolean;
  onClick: () => void;
  onMouseEnter: () => void;
}

export const SearchResult: React.FC<SearchResultProps> = ({
  stock,
  isActive,
  onClick,
  onMouseEnter
}) => {
  // Extract base ticker (e.g. RELIANCE from RELIANCE.NS)
  const tickerBase = stock.ticker.split('.')[0];

  return (
    <div
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      className={`flex items-center justify-between p-3.5 rounded-xl cursor-pointer transition-all duration-200 font-sans border border-transparent ${
        isActive
          ? 'bg-brand/10 border-brand/20 text-white shadow-premium'
          : 'hover:bg-white/[0.02] text-textMuted hover:text-white'
      }`}
    >
      <div className="flex items-center gap-3">
        {/* Sleek Logo Placeholder with initials */}
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-mono font-bold shrink-0 border ${
          isActive 
            ? 'bg-brand/20 border-brand/30 text-white' 
            : 'bg-surfaceDark border-borderDark text-textMuted'
        }`}>
          {tickerBase.slice(0, 2)}
        </div>

        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm text-white tracking-wide font-mono">{tickerBase}</span>
            <span className="text-[9px] px-1.5 py-0.5 rounded font-mono font-bold bg-white/[0.04] border border-borderDark text-textMuted">
              {stock.exchange}
            </span>
          </div>
          <span className="text-xs truncate max-w-[200px] md:max-w-xs">{stock.name}</span>
        </div>
      </div>

      <div className="text-[10px] font-mono text-textMuted uppercase self-center">
        {stock.exchange === 'NSE' ? 'NSE India' : stock.exchange}
      </div>
    </div>
  );
};
