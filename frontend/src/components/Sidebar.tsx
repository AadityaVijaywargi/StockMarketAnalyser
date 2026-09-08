import React from 'react';
import { 
  LayoutDashboard, 
  TrendingUp, 
  Globe, 
  Star, 
  Briefcase, 
  Play, 
  Settings, 
  Search
} from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

interface SidebarProps {
  onSearchClick: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ onSearchClick }) => {
  const location = useLocation();

  // Find the last searched stock or default to RELIANCE.NS
  const lastStock = (() => {
    try {
      const cached = localStorage.getItem('recent_searches');
      if (cached) {
        const searches = JSON.parse(cached);
        if (searches.length > 0) return searches[0];
      }
    } catch (e) {
      console.error("Failed to parse recent searches in sidebar", e);
    }
    return 'RELIANCE.NS';
  })();

  const menuItems = [
    { name: 'Dashboard', path: `/dashboard/${lastStock}`, icon: LayoutDashboard },
    { name: 'Analyze Stock', path: '/', icon: Search, action: onSearchClick },
    { name: 'Watchlist', path: '/watchlist', icon: Star },
    { name: 'Market Overview', path: '/market', icon: Globe },
    { name: 'Portfolio', path: '/portfolio', icon: Briefcase },
    { name: 'Backtesting', path: '#', icon: Play, disabled: true, tag: 'SOON' },
    { name: 'Settings', path: '#', icon: Settings, disabled: true },
  ];

  return (
    <aside className="w-64 bg-surface border-r border-borderDark flex flex-col justify-between h-screen sticky top-0">
      <div className="flex flex-col">
        {/* Logo/Branding Section */}
        <Link
          to="/"
          onClick={onSearchClick}
          aria-label="Go to Home"
          className="p-6 flex items-center gap-3 border-b border-borderDark cursor-pointer hover:opacity-90 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 outline-none focus:ring-1 focus:ring-brand/30"
        >
          <div className="w-8 h-8 rounded-lg bg-brand flex items-center justify-center shadow-lg shadow-brand/20">
            <TrendingUp className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-lg tracking-wider text-white">STONKS</h1>
            <p className="text-[9px] text-textMuted tracking-wider font-mono uppercase">AI EQUITY RESEARCH</p>
          </div>
        </Link>

        {/* Navigation Section */}
        <nav className="p-4 flex flex-col gap-1.5">
          {menuItems.map((item, idx) => {
            const Icon = item.icon;
            // Match subpaths like /dashboard/TCS or /watchlist
            const isActive = item.name === 'Dashboard' 
              ? location.pathname.startsWith('/dashboard') 
              : item.path !== '/' && item.path !== '#' && location.pathname.startsWith(item.path);
            const isHomeActive = item.path === '/' && location.pathname === '/';
            
            if (item.disabled) {
              return (
                <div 
                  key={idx} 
                  className="flex items-center justify-between p-3 rounded-lg text-textMuted cursor-not-allowed hover:bg-white/[0.02] transition-all text-sm"
                >
                  <div className="flex items-center gap-3">
                    <Icon className="w-4 h-4" />
                    <span>{item.name}</span>
                  </div>
                  {item.tag && (
                    <span className="text-[9px] bg-white/10 text-white font-mono px-1.5 py-0.5 rounded tracking-wider">
                      {item.tag}
                    </span>
                  )}
                </div>
              );
            }

            if (item.action) {
              return (
                <button
                  key={idx}
                  onClick={item.action}
                  className={`flex items-center gap-3 p-3 rounded-lg text-sm font-medium transition-all w-full text-left ${
                    isHomeActive 
                      ? 'bg-brand/10 text-brand border-l-2 border-brand font-semibold' 
                      : 'text-textMuted hover:text-white hover:bg-white/[0.05]'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.name}</span>
                </button>
              );
            }

            return (
              <Link
                key={idx}
                to={item.path}
                className={`flex items-center gap-3 p-3 rounded-lg text-sm font-medium transition-all ${
                  isActive 
                    ? 'bg-brand/10 text-brand border-l-2 border-brand font-semibold' 
                    : 'text-textMuted hover:text-white hover:bg-white/[0.05]'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Footer / Release Info */}
      <div className="p-6 border-t border-borderDark text-[11px] text-textMuted font-mono flex flex-col gap-1">
        <div className="flex items-center gap-1.5 text-bullish">
          <div className="w-1.5 h-1.5 rounded-full bg-bullish animate-pulse" />
          <span>API Connected</span>
        </div>
        <div>v1.0.0 (Deterministic)</div>
      </div>
    </aside>
  );
};
