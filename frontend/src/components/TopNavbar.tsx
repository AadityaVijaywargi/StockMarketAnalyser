import React from 'react';
import { Bell, Sun } from 'lucide-react';
import { SearchBar } from './search/SearchBar';

interface TopNavbarProps {
  onSearch: (ticker: string) => void;
  isLoading: boolean;
}

export const TopNavbar: React.FC<TopNavbarProps> = ({ onSearch, isLoading }) => {
  return (
    <div className="h-16 bg-surface border-b border-borderDark flex items-center justify-between px-6 sticky top-0 z-30">
      
      {/* Search Input */}
      <SearchBar
        onSearch={onSearch}
        isLoading={isLoading}
        placeholder="Command + K to search tickers..."
        compact={true}
        className="w-56 md:w-80"
      />

      {/* Action utilities */}
      <div className="flex items-center gap-4">
        {/* Notifications */}
        <button className="relative w-8 h-8 rounded-lg hover:bg-white/[0.03] border border-transparent hover:border-borderDark flex items-center justify-center text-textMuted hover:text-white transition-all">
          <Bell className="w-4 h-4" />
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-brand rounded-full" />
        </button>

        {/* Theme Toggle (dark mode locked) */}
        <button className="w-8 h-8 rounded-lg hover:bg-white/[0.03] border border-transparent hover:border-borderDark flex items-center justify-center text-textMuted hover:text-white transition-all">
          <Sun className="w-4 h-4" />
        </button>

        <div className="h-6 w-px bg-borderDark" />

        {/* Profile user badge */}
        <div className="flex items-center gap-2.5 pl-1 cursor-pointer group">
          <div className="w-7 h-7 rounded-full bg-brand/10 border border-brand/20 flex items-center justify-center text-brand font-mono font-bold text-xs">
            AD
          </div>
          <div className="hidden sm:flex flex-col text-left">
            <span className="text-[11px] font-bold text-white leading-none">Aadi</span>
            <span className="text-[9px] text-textMuted leading-none mt-1">Research Lead</span>
          </div>
        </div>
      </div>
    </div>
  );
};
