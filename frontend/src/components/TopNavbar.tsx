import React from 'react';
import { Bell, Sun } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { SearchBar } from './search/SearchBar';
import { useNotifications } from '../context/NotificationContext';
import { useAuth } from '../context/AuthContext';

interface TopNavbarProps {
  onSearch: (ticker: string) => void;
  isLoading: boolean;
}

export const TopNavbar: React.FC<TopNavbarProps> = ({ onSearch, isLoading }) => {
  const { unreadCount, toggleOpen, isOpen } = useNotifications();
  const { username, isAdmin } = useAuth();
  const navigate = useNavigate();

  const displayName = username || 'User';
  const initials = displayName.slice(0, 2).toUpperCase();

  return (
    <div className="h-16 bg-surface border-b border-borderDark flex items-center justify-between px-6 sticky top-0 z-30 shrink-0">
      
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
        {/* Notifications Button & Badge */}
        <button
          onClick={toggleOpen}
          title="Notification Center"
          className={`relative w-9 h-9 rounded-lg border transition-all focus:outline-none cursor-pointer ${
            isOpen
              ? 'bg-brand/20 border-brand/40 text-brand'
              : 'hover:bg-white/[0.05] border-transparent hover:border-borderDark text-textMuted hover:text-white'
          }`}
        >
          <Bell className="w-4.5 h-4.5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-brand text-white font-mono font-bold text-[10px] px-1.5 py-0.2 rounded-full shadow-lg shadow-brand/40 min-w-[18px] text-center border border-background">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>

        {/* Theme Toggle (dark mode locked) */}
        <button className="w-8 h-8 rounded-lg hover:bg-white/[0.03] border border-transparent hover:border-borderDark flex items-center justify-center text-textMuted hover:text-white transition-all">
          <Sun className="w-4 h-4" />
        </button>

        <div className="h-6 w-px bg-borderDark" />

        {/* Profile user badge - links to Settings (account/logout live there) */}
        <button
          onClick={() => navigate('/settings')}
          title="Account settings"
          className="flex items-center gap-2.5 pl-1 cursor-pointer group"
        >
          <div className="w-7 h-7 rounded-full bg-brand/10 border border-brand/20 flex items-center justify-center text-brand font-mono font-bold text-xs">
            {initials}
          </div>
          <div className="hidden sm:flex flex-col text-left">
            <span className="text-[11px] font-bold text-white leading-none group-hover:text-brand transition-colors">{displayName}</span>
            <span className="text-[9px] text-textMuted leading-none mt-1">{isAdmin ? 'Admin' : 'Member'}</span>
          </div>
        </button>
      </div>
    </div>
  );
};
