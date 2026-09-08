import React, { useEffect, useState } from 'react';
import {
  LayoutDashboard,
  TrendingUp,
  Globe,
  Star,
  Briefcase,
  Play,
  Settings,
  Search,
  Menu,
  X,
  GitCompare
} from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

interface SidebarProps {
  onSearchClick: () => void;
}

const DESKTOP_QUERY = '(min-width: 1024px)';

export const Sidebar: React.FC<SidebarProps> = ({ onSearchClick }) => {
  const location = useLocation();
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  // Whether to use the static desktop layout vs. the off-canvas mobile
  // drawer is decided here in JS via matchMedia, not by layering a `lg:`
  // Tailwind override on top of an always-applied `-translate-x-full`.
  // That override approach depends on the compiled stylesheet's rule
  // order/specificity lining up exactly right, which held locally but
  // silently broke on the production (Vercel) build - the sidebar's
  // transform never resolved back to 0 at desktop widths, hiding it
  // entirely. Deciding in JS removes that fragility altogether.
  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(DESKTOP_QUERY).matches : true
  );

  useEffect(() => {
    const mql = window.matchMedia(DESKTOP_QUERY);
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  // Close the off-canvas drawer on every navigation (mobile only - harmless
  // no-op on desktop where the drawer classes never apply).
  useEffect(() => {
    setIsMobileOpen(false);
  }, [location.pathname]);

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
    { name: 'Compare', path: '/compare', icon: GitCompare },
    { name: 'Backtesting', path: '/backtesting', icon: Play },
    { name: 'Settings', path: '/settings', icon: Settings },
  ];

  return (
    <>
      {/* Mobile menu trigger - only shown when the drawer is closed on small screens */}
      {!isDesktop && (
        <button
          onClick={() => setIsMobileOpen(true)}
          aria-label="Open navigation menu"
          className={`fixed top-4 left-4 z-50 w-10 h-10 rounded-xl bg-surface border border-borderDark flex items-center justify-center text-white shadow-lg transition-opacity ${
            isMobileOpen ? 'opacity-0 pointer-events-none' : 'opacity-100'
          }`}
        >
          <Menu className="w-5 h-5" />
        </button>
      )}

      {/* Backdrop, mobile only, while the drawer is open */}
      {!isDesktop && isMobileOpen && (
        <div
          onClick={() => setIsMobileOpen(false)}
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
        />
      )}

      <aside
        className={`w-64 bg-surface border-r border-borderDark flex flex-col justify-between h-screen z-50 transition-transform duration-300 ease-in-out ${
          isDesktop
            ? 'sticky top-0'
            : `fixed top-0 left-0 ${isMobileOpen ? 'translate-x-0' : '-translate-x-full'}`
        }`}
      >
      <div className="flex flex-col">
        {/* Logo/Branding Section */}
        {!isDesktop && (
          <button
            onClick={() => setIsMobileOpen(false)}
            aria-label="Close navigation menu"
            className="absolute top-4 right-4 w-8 h-8 rounded-lg hover:bg-white/[0.05] flex items-center justify-center text-textMuted hover:text-white"
          >
            <X className="w-4.5 h-4.5" />
          </button>
        )}
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
    </>
  );
};
