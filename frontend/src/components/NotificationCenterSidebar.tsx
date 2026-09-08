import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Bell, 
  X, 
  CheckCheck, 
  Trash2, 
  ArrowRight, 
  ShieldAlert, 
  AlertTriangle, 
  Info, 
  Clock, 
  Pin, 
  Search, 
  PanelRightClose, 
  PanelRightOpen,
  Filter,
  Check,
  Zap,
  TrendingUp,
  Eye,
  SlidersHorizontal,
  Bookmark
} from 'lucide-react';
import { AppNotification } from '../types';
import { useNotifications } from '../context/NotificationContext';
import { motion, AnimatePresence } from 'framer-motion';

type FilterCategory = 'ALL' | 'UNREAD' | 'TRADE_SIGNALS' | 'RECOMMENDATIONS' | 'WATCHLIST' | 'MARKET_ALERTS' | 'SYSTEM';

export const NotificationCenterSidebar: React.FC = () => {
  const navigate = useNavigate();
  const { 
    notifications, 
    unreadCount, 
    isOpen, 
    isCollapsed, 
    pinnedIds,
    toggleCollapse, 
    close, 
    togglePin, 
    markAsRead, 
    markAllAsRead, 
    deleteNotification, 
    clearAll 
  } = useNotifications();

  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterCategory>('ALL');

  // Listen for ESC key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        close();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, close]);

  if (!isOpen) return null;

  const handleOpenAnalysis = (ticker: string, id: string) => {
    markAsRead(id);
    navigate(`/dashboard/${ticker.toUpperCase()}`);
  };

  // Filter notifications based on search and category
  const filteredNotifications = notifications.filter(n => {
    // Search query match
    const q = searchQuery.toLowerCase().trim();
    if (q) {
      const matchTicker = n.ticker.toLowerCase().includes(q);
      const matchCompany = n.company_name.toLowerCase().includes(q);
      const matchReason = n.change_reason?.some(r => r.toLowerCase().includes(q));
      if (!matchTicker && !matchCompany && !matchReason) return false;
    }

    // Category match
    switch (activeFilter) {
      case 'UNREAD':
        return !n.read;
      case 'TRADE_SIGNALS':
        return n.type === 'RECOMMENDATION_CHANGE' || (n as any).type === 'TRADE_SIGNAL';
      case 'RECOMMENDATIONS':
        return n.type === 'RECOMMENDATION_CHANGE';
      case 'WATCHLIST':
        return true; // All notifications in system are for watched stocks
      case 'MARKET_ALERTS':
        return n.severity === 'IMPORTANT' || n.severity === 'WARNING';
      case 'SYSTEM':
        return n.severity === 'INFO';
      case 'ALL':
      default:
        return true;
    }
  });

  // Group notifications into Pinned, Today, Yesterday, Older
  const pinnedList = filteredNotifications.filter(n => pinnedIds.includes(n.id));
  const unpinnedList = filteredNotifications.filter(n => !pinnedIds.includes(n.id));

  const groupUnpinned = (list: AppNotification[]) => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const groups: { unread: AppNotification[]; today: AppNotification[]; yesterday: AppNotification[]; older: AppNotification[] } = {
      unread: [],
      today: [],
      yesterday: [],
      older: []
    };

    list.forEach(n => {
      const d = new Date(n.timestamp);
      if (!n.read) {
        groups.unread.push(n);
      } else if (d.toDateString() === today.toDateString()) {
        groups.today.push(n);
      } else if (d.toDateString() === yesterday.toDateString()) {
        groups.yesterday.push(n);
      } else {
        groups.older.push(n);
      }
    });

    return groups;
  };

  const grouped = groupUnpinned(unpinnedList);

  const getSeverityBadge = (severity: string) => {
    if (severity === 'IMPORTANT') {
      return (
        <span className="text-[9px] font-mono font-bold uppercase tracking-wider bg-bearish/15 text-bearish border border-bearish/30 px-2 py-0.5 rounded-full flex items-center gap-1">
          <ShieldAlert className="w-3 h-3" /> IMPORTANT
        </span>
      );
    }
    if (severity === 'WARNING') {
      return (
        <span className="text-[9px] font-mono font-bold uppercase tracking-wider bg-yellow-500/15 text-yellow-500 border border-yellow-500/30 px-2 py-0.5 rounded-full flex items-center gap-1">
          <AlertTriangle className="w-3 h-3" /> WARNING
        </span>
      );
    }
    return (
      <span className="text-[9px] font-mono font-bold uppercase tracking-wider bg-brand/15 text-brand border border-brand/30 px-2 py-0.5 rounded-full flex items-center gap-1">
        <Info className="w-3 h-3" /> INFO
      </span>
    );
  };

  const formatTimestamp = (iso: string) => {
    try {
      const d = new Date(iso);
      const now = new Date();
      const diffMins = Math.floor((now.getTime() - d.getTime()) / 60000);
      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
      return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
    } catch {
      return iso;
    }
  };

  const getPriorityBadge = (priority?: string) => {
    if (priority === 'CRITICAL') {
      return <span className="text-[9px] font-mono font-bold uppercase tracking-wider bg-rose-500/20 text-rose-400 border border-rose-500/40 px-2 py-0.5 rounded-full">CRITICAL</span>;
    }
    if (priority === 'HIGH') {
      return <span className="text-[9px] font-mono font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 px-2 py-0.5 rounded-full">HIGH</span>;
    }
    if (priority === 'MEDIUM') {
      return <span className="text-[9px] font-mono font-bold uppercase tracking-wider bg-amber-500/20 text-amber-400 border border-amber-500/40 px-2 py-0.5 rounded-full">MEDIUM</span>;
    }
    return <span className="text-[9px] font-mono font-bold uppercase tracking-wider bg-slate-500/20 text-slate-400 border border-slate-500/40 px-2 py-0.5 rounded-full">LOW</span>;
  };

  const renderCard = (n: AppNotification) => {
    const isUnread = !n.read;
    const isPinned = pinnedIds.includes(n.id);
    const oldRecStyle = n.old_recommendation === 'STRONG BUY' || n.old_recommendation === 'BUY' || n.old_recommendation === 'ACCUMULATE' ? 'text-bullish' : n.old_recommendation === 'REDUCE' || n.old_recommendation === 'SELL' || n.old_recommendation === 'STRONG SELL' ? 'text-bearish' : 'text-yellow-500';
    const newRecStyle = n.new_recommendation === 'STRONG BUY' || n.new_recommendation === 'BUY' || n.new_recommendation === 'ACCUMULATE' ? 'text-bullish' : n.new_recommendation === 'REDUCE' || n.new_recommendation === 'SELL' || n.new_recommendation === 'STRONG SELL' ? 'text-bearish' : 'text-yellow-500';

    return (
      <div
        key={n.id}
        className={`p-3.5 rounded-xl border transition-all relative group ${
          isUnread
            ? 'bg-brand/10 border-brand/30 shadow-premium'
            : 'bg-surface/80 border-borderDark hover:border-borderDark hover:bg-surface'
        }`}
      >
        {/* Top Header: Priority Badge, Ticker, Relative Time, Action Icons */}
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            {getPriorityBadge(n.priority)}
            <span className="text-xs font-mono font-bold text-white">
              {n.ticker}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-mono text-textMuted">
              {formatTimestamp(n.timestamp)}
            </span>

            {/* Pin Toggle */}
            <button
              onClick={() => togglePin(n.id)}
              className={`p-1 rounded transition-colors ${
                isPinned ? 'text-yellow-400' : 'text-textMuted hover:text-white opacity-0 group-hover:opacity-100'
              }`}
              title={isPinned ? "Unpin alert" : "Pin alert to top"}
            >
              <Pin className="w-3.5 h-3.5" />
            </button>

            {/* Dismiss */}
            <button
              onClick={() => deleteNotification(n.id)}
              className="p-1 rounded text-textMuted hover:text-bearish transition-colors opacity-0 group-hover:opacity-100"
              title="Dismiss notification"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Company Title */}
        <h4 className="text-xs font-semibold text-white mb-2">
          {n.company_name}
        </h4>

        {/* Transition Metric Box */}
        <div className="bg-background/80 p-2 rounded-lg border border-borderDark/60 flex items-center justify-between font-mono text-[11px] mb-2.5">
          <div className="flex items-center gap-1.5">
            <span className="text-textMuted text-[10px]">Rec:</span>
            <span className={`font-bold ${oldRecStyle}`}>{n.old_recommendation}</span>
            <ArrowRight className="w-3 h-3 text-textMuted" />
            <span className={`font-bold ${newRecStyle}`}>{n.new_recommendation}</span>
          </div>

          <div className="flex items-center gap-1">
            <span className="text-textMuted text-[10px]">Conf:</span>
            <span className="text-textMuted font-bold">{n.old_confidence.toFixed(0)}%</span>
            <ArrowRight className="w-3 h-3 text-textMuted" />
            <span className="text-white font-bold">{n.new_confidence.toFixed(0)}%</span>
          </div>
        </div>

        {/* Target & Stop Loss metrics if present */}
        {(n.target_price || n.stop_loss) && (
          <div className="grid grid-cols-2 gap-2 mb-2 font-mono text-[11px]">
            {n.target_price && (
              <div className="bg-emerald-500/10 border border-emerald-500/20 p-1.5 rounded text-emerald-400">
                Target: ₹{n.target_price}
              </div>
            )}
            {n.stop_loss && (
              <div className="bg-rose-500/10 border border-rose-500/20 p-1.5 rounded text-rose-400">
                Stop: ₹{n.stop_loss}
              </div>
            )}
          </div>
        )}

        {/* Change Reasons list */}
        {n.change_reason && n.change_reason.length > 0 && (
          <div className="flex flex-col gap-1 text-[11px] text-textMuted mb-3">
            {n.change_reason.map((reason, idx) => (
              <div key={idx} className="flex items-start gap-1.5">
                <span className="w-1 h-1 rounded-full bg-brand shrink-0 mt-1.5" />
                <span className="line-clamp-2">{reason}</span>
              </div>
            ))}
          </div>
        )}

        {/* Timeline updates count if grouped */}
        {n.timeline && n.timeline.length > 0 && (
          <div className="text-[10px] font-mono text-brand mb-2 font-bold">
            📈 {n.timeline.length + 1} recommendation updates recorded
          </div>
        )}

        {/* Quick Action Footer Buttons */}
        <div className="flex items-center justify-between pt-2 border-t border-borderDark/60 text-[11px] font-mono">
          {isUnread ? (
            <button
              onClick={() => markAsRead(n.id)}
              className="text-textMuted hover:text-white flex items-center gap-1 transition-colors cursor-pointer"
            >
              <Check className="w-3 h-3 text-bullish" />
              <span>Mark Read</span>
            </button>
          ) : (
            <span className="text-textMuted text-[10px]">Read</span>
          )}

          <button
            onClick={() => handleOpenAnalysis(n.ticker, n.id)}
            className="flex items-center gap-1 text-brand hover:text-brand/80 font-bold transition-transform group-hover:translate-x-0.5 cursor-pointer"
          >
            <span>Open Workspace</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  };

  const renderSection = (title: string, items: AppNotification[], icon?: React.ReactNode) => {
    if (items.length === 0) return null;

    return (
      <div className="flex flex-col gap-2">
        <h5 className="text-[10px] font-mono uppercase font-bold text-textMuted tracking-wider flex items-center gap-1.5 px-1 border-b border-borderDark pb-1">
          {icon}
          <span>{title}</span>
          <span className="text-[9px] text-textMuted font-normal">({items.length})</span>
        </h5>
        <div className="flex flex-col gap-2.5">
          {items.map(renderCard)}
        </div>
      </div>
    );
  };

  // Render Collapsed Sidebar View (64px width strip)
  if (isCollapsed) {
    return (
      <aside className="w-[64px] bg-background border-l border-borderDark h-screen flex flex-col justify-between items-center py-4 z-40 shrink-0 transition-all duration-300">
        <div className="flex flex-col items-center gap-4">
          <button
            onClick={toggleCollapse}
            className="p-2 rounded-lg bg-brand/10 text-brand hover:bg-brand/20 border border-brand/20 transition-all cursor-pointer"
            title="Expand Notification Sidebar (420px)"
          >
            <PanelRightOpen className="w-5 h-5" />
          </button>

          <div className="relative">
            <Bell className="w-5 h-5 text-white" />
            {unreadCount > 0 && (
              <span className="absolute -top-1.5 -right-2 bg-brand text-white font-mono font-bold text-[9px] px-1 rounded-full shadow-md min-w-[16px] text-center border border-background">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-col items-center gap-3">
          <button
            onClick={() => setActiveFilter('ALL')}
            className={`p-2 rounded-lg transition-all cursor-pointer ${activeFilter === 'ALL' ? 'bg-brand text-white' : 'text-textMuted hover:text-white'}`}
            title="All Notifications"
          >
            <Filter className="w-4 h-4" />
          </button>

          <button
            onClick={close}
            className="p-2 rounded-lg text-textMuted hover:text-bearish transition-all cursor-pointer"
            title="Close Notification Sidebar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </aside>
    );
  }

  // Expanded Persistent Right Sidebar View (420px)
  return (
    <aside className="w-[420px] min-w-[380px] max-w-[450px] bg-background border-l border-borderDark h-screen flex flex-col justify-between shadow-premium z-40 shrink-0 transition-all duration-300 overflow-hidden">
      
      {/* 1. Header Bar */}
      <div className="p-4 border-b border-borderDark bg-surface flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-brand/10 border border-brand/20 text-brand">
            <Bell className="w-4.5 h-4.5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-white font-mono">Notifications</h3>
              {unreadCount > 0 && (
                <span className="text-[10px] font-mono bg-brand text-white px-2 py-0.5 rounded-full font-bold">
                  {unreadCount} UNREAD
                </span>
              )}
            </div>
            <p className="text-[11px] text-textMuted">Real-time trade & Watchlist signals.</p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={toggleCollapse}
            className="p-1.5 rounded-lg hover:bg-white/10 text-textMuted hover:text-white transition-all cursor-pointer"
            title="Collapse Sidebar (64px)"
          >
            <PanelRightClose className="w-4 h-4" />
          </button>
          <button
            onClick={close}
            className="p-1.5 rounded-lg hover:bg-white/10 text-textMuted hover:text-white transition-all cursor-pointer"
            title="Close Notification Panel"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 2. Controls & Search Filter Bar */}
      <div className="p-3 border-b border-borderDark bg-surface/90 flex flex-col gap-2.5 shrink-0">
        {/* Search Bar */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-textMuted absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search notifications..."
            className="w-full bg-background border border-borderDark rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder:text-textMuted focus:outline-none focus:border-brand/40 transition-all font-mono"
          />
          {searchQuery && (
            <button 
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-2 text-textMuted hover:text-white text-xs cursor-pointer"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* Quick Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-[10px] font-mono">
          {(['ALL', 'UNREAD', 'TRADE_SIGNALS', 'RECOMMENDATIONS', 'MARKET_ALERTS', 'SYSTEM'] as FilterCategory[]).map(cat => (
            <button
              key={cat}
              onClick={() => setActiveFilter(cat)}
              className={`px-2.5 py-1 rounded-md font-semibold whitespace-nowrap transition-all cursor-pointer ${
                activeFilter === cat
                  ? 'bg-brand text-white shadow-sm'
                  : 'bg-background text-textMuted hover:text-white border border-borderDark'
              }`}
            >
              {cat.replace('_', ' ')}
            </button>
          ))}
        </div>

        {/* Global Action Utility Buttons */}
        {notifications.length > 0 && (
          <div className="flex items-center justify-between pt-1 text-[11px] font-mono">
            <button
              onClick={markAllAsRead}
              className="flex items-center gap-1 text-brand hover:text-brand/80 font-semibold transition-colors cursor-pointer"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              <span>Mark all read</span>
            </button>

            <button
              onClick={clearAll}
              className="flex items-center gap-1 text-bearish hover:text-bearish/80 transition-colors cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear read</span>
            </button>
          </div>
        )}
      </div>

      {/* 3. Notification Stream List */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-5">
        {filteredNotifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center gap-3 my-auto py-12">
            <div className="w-12 h-12 rounded-2xl bg-brand/10 border border-brand/20 flex items-center justify-center text-brand">
              <Bell className="w-6 h-6" />
            </div>
            <div className="flex flex-col gap-1 max-w-xs">
              <h4 className="text-xs font-bold text-white font-mono">No notifications found.</h4>
              <p className="text-[11px] text-textMuted">
                {searchQuery || activeFilter !== 'ALL' 
                  ? 'No notifications match your search or filter criteria.' 
                  : 'Watchlist recommendation & trade signal changes will appear here automatically.'}
              </p>
            </div>
          </div>
        ) : (
          <>
            {renderSection('Pinned Alerts', pinnedList, <Bookmark className="w-3 h-3 text-yellow-500" />)}
            {renderSection('Unread Notifications', grouped.unread, <Bell className="w-3 h-3 text-brand" />)}
            {renderSection('Today', grouped.today, <Clock className="w-3 h-3 text-textMuted" />)}
            {renderSection('Yesterday', grouped.yesterday, <Clock className="w-3 h-3 text-textMuted" />)}
            {renderSection('Older', grouped.older, <Clock className="w-3 h-3 text-textMuted" />)}
          </>
        )}
      </div>

      {/* 4. Footer */}
      <div className="p-3 border-t border-borderDark bg-surface text-[10px] text-textMuted font-mono flex items-center justify-between shrink-0">
        <span>Retention: Max 100 alerts</span>
        <span>Press ESC to close</span>
      </div>
    </aside>
  );
};
