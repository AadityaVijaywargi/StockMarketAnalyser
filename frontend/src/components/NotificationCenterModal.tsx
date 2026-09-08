import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, X, CheckCheck, Trash2, ArrowRight, ShieldAlert, Sparkles, AlertTriangle, Info, Clock } from 'lucide-react';
import { AppNotification } from '../types';
import { useNotifications } from '../context/NotificationContext';
import { motion, AnimatePresence } from 'framer-motion';

interface NotificationCenterModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NotificationCenterModal: React.FC<NotificationCenterModalProps> = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const { notifications, unreadCount, markAsRead, markAllAsRead, deleteNotification, clearAll } = useNotifications();

  if (!isOpen) return null;

  const handleNotificationClick = (n: AppNotification) => {
    markAsRead(n.id);
    onClose();
    navigate(`/dashboard/${n.ticker}`);
  };

  // Group notifications by relative date
  const groupNotifications = (list: AppNotification[]) => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const groups: { today: AppNotification[]; yesterday: AppNotification[]; week: AppNotification[]; older: AppNotification[] } = {
      today: [],
      yesterday: [],
      week: [],
      older: [],
    };

    list.forEach(n => {
      const d = new Date(n.timestamp);
      if (d.toDateString() === today.toDateString()) {
        groups.today.push(n);
      } else if (d.toDateString() === yesterday.toDateString()) {
        groups.yesterday.push(n);
      } else if (today.getTime() - d.getTime() < 7 * 24 * 60 * 60 * 1000) {
        groups.week.push(n);
      } else {
        groups.older.push(n);
      }
    });

    return groups;
  };

  const grouped = groupNotifications(notifications);

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
      const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      return timeStr;
    } catch {
      return iso;
    }
  };

  const renderSection = (title: string, items: AppNotification[]) => {
    if (items.length === 0) return null;

    return (
      <div className="flex flex-col gap-2">
        <h4 className="text-[10px] font-mono uppercase font-bold text-textMuted tracking-wider px-1 border-b border-borderDark/30 pb-1">
          {title} ({items.length})
        </h4>
        <div className="flex flex-col gap-2.5">
          {items.map(n => {
            const isUnread = !n.read;
            const oldRecStyle = n.old_recommendation === 'BUY' ? 'text-bullish' : n.old_recommendation === 'AVOID' ? 'text-bearish' : 'text-yellow-500';
            const newRecStyle = n.new_recommendation === 'BUY' ? 'text-bullish' : n.new_recommendation === 'AVOID' ? 'text-bearish' : 'text-yellow-500';

            return (
              <div
                key={n.id}
                onClick={() => handleNotificationClick(n)}
                className={`p-4 rounded-xl border transition-all cursor-pointer flex flex-col gap-2.5 relative group ${
                  isUnread
                    ? 'bg-brand/10 border-brand/30 shadow-lg shadow-brand/5'
                    : 'bg-surface/80 border-borderDark/60 hover:border-borderDark hover:bg-surface'
                }`}
              >
                {/* Header Row: Severity Badge, Ticker & Timestamp */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {getSeverityBadge(n.severity)}
                    <span className="text-xs font-mono font-bold text-white">
                      {n.company_name} <span className="text-textMuted">({n.ticker})</span>
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono text-textMuted flex items-center gap-1">
                      <Clock className="w-3 h-3 text-textMuted" /> {formatTimestamp(n.timestamp)}
                    </span>
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        deleteNotification(n.id);
                      }}
                      title="Delete Notification"
                      className="text-textMuted hover:text-bearish p-1 transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Transition Metric Block */}
                <div className="bg-background/60 p-2.5 rounded-lg border border-borderDark/40 flex items-center justify-between font-mono text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-textMuted">Recommendation:</span>
                    <span className={`font-bold ${oldRecStyle}`}>{n.old_recommendation}</span>
                    <ArrowRight className="w-3.5 h-3.5 text-textMuted" />
                    <span className={`font-bold ${newRecStyle}`}>{n.new_recommendation}</span>
                  </div>

                  <div className="flex items-center gap-1.5 text-[11px]">
                    <span className="text-textMuted">Confidence:</span>
                    <span className="text-white font-bold">{n.old_confidence.toFixed(0)}%</span>
                    <ArrowRight className="w-3 h-3 text-textMuted" />
                    <span className="text-white font-bold">{n.new_confidence.toFixed(0)}%</span>
                  </div>
                </div>

                {/* Change Reason Bullet Points */}
                {n.change_reason && n.change_reason.length > 0 && (
                  <div className="flex flex-col gap-1 text-[11px] text-textMuted">
                    {n.change_reason.map((reason, idx) => (
                      <div key={idx} className="flex items-start gap-1.5">
                        <span className="w-1 h-1 rounded-full bg-brand shrink-0 mt-1.5" />
                        <span className="line-clamp-1">{reason}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Tap to open analysis prompt */}
                <div className="flex items-center justify-end text-[10px] font-mono text-brand font-semibold group-hover:translate-x-1 transition-transform">
                  <span>Tap to open analysis</span>
                  <ArrowRight className="w-3 h-3 ml-1" />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex justify-end">
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="bg-surface border-l border-borderDark w-full max-w-md h-full flex flex-col justify-between shadow-2xl"
      >
        {/* Modal Top Header */}
        <div className="p-5 border-b border-borderDark flex items-center justify-between bg-background/50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-brand/10 border border-brand/20 flex items-center justify-center text-brand">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white font-mono">Notification Center</h3>
                {unreadCount > 0 && (
                  <span className="text-[10px] font-mono bg-brand text-white px-2 py-0.5 rounded-full font-bold">
                    {unreadCount} UNREAD
                  </span>
                )}
              </div>
              <p className="text-[11px] text-textMuted">Watchlist recommendation change alerts.</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/10 text-textMuted hover:text-white transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Global Actions Bar */}
        {notifications.length > 0 && (
          <div className="px-5 py-2.5 bg-background/30 border-b border-borderDark/40 flex items-center justify-between text-xs font-mono">
            <button
              onClick={markAllAsRead}
              className="flex items-center gap-1.5 text-brand hover:text-brand/80 transition-colors font-semibold"
            >
              <CheckCheck className="w-4 h-4" />
              <span>Mark all as read</span>
            </button>

            <button
              onClick={clearAll}
              className="flex items-center gap-1 text-bearish hover:text-bearish/80 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear all</span>
            </button>
          </div>
        )}

        {/* Notification Stream Content */}
        <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-6">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center gap-3 my-auto py-12">
              <div className="w-14 h-14 rounded-2xl bg-brand/10 border border-brand/20 flex items-center justify-center text-brand animate-pulse">
                <Bell className="w-7 h-7" />
              </div>
              <div className="flex flex-col gap-1 max-w-xs">
                <h4 className="text-sm font-bold text-white font-mono">No notifications yet.</h4>
                <p className="text-xs text-textMuted">Quantitative recommendation changes for your watched stocks will appear here automatically.</p>
              </div>
            </div>
          ) : (
            <>
              {renderSection('Today', grouped.today)}
              {renderSection('Yesterday', grouped.yesterday)}
              {renderSection('Earlier This Week', grouped.week)}
              {renderSection('Older', grouped.older)}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-borderDark bg-background/50 text-[10px] text-textMuted font-mono flex items-center justify-between">
          <span>Retention: Max 100 alerts</span>
          <span>STONKS Signal Engine</span>
        </div>
      </motion.div>
    </div>
  );
};
