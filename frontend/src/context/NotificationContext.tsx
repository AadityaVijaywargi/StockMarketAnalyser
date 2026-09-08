import React, { createContext, useContext, useState, useEffect } from 'react';
import { AppNotification, DeterministicAnalysisReport } from '../types';
import { notificationService, NOTIFICATIONS_UPDATED_EVENT } from '../services/notification_service';
import { useWatchlist } from './WatchlistContext';

interface NotificationContextType {
  notifications: AppNotification[];
  unreadCount: number;
  isOpen: boolean;
  isCollapsed: boolean;
  pinnedIds: string[];
  setIsOpen: (val: boolean) => void;
  setIsCollapsed: (val: boolean) => void;
  toggleOpen: () => void;
  toggleCollapse: () => void;
  close: () => void;
  togglePin: (id: string) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  deleteNotification: (id: string) => void;
  clearAll: () => void;
  checkAndNotify: (report: DeterministicAnalysisReport) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [notifications, setNotifications] = useState<AppNotification[]>(() => notificationService.getNotifications());
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);
  const [pinnedIds, setPinnedIds] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem('stonks_pinned_notifications');
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  const { isFavorite } = useWatchlist();

  useEffect(() => {
    const handleUpdate = () => {
      setNotifications(notificationService.getNotifications());
    };
    window.addEventListener(NOTIFICATIONS_UPDATED_EVENT, handleUpdate);
    return () => window.removeEventListener(NOTIFICATIONS_UPDATED_EVENT, handleUpdate);
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;

  const toggleOpen = () => setIsOpen(prev => !prev);
  const toggleCollapse = () => setIsCollapsed(prev => !prev);
  const close = () => setIsOpen(false);

  const togglePin = (id: string) => {
    setPinnedIds(prev => {
      const exists = prev.includes(id);
      const next = exists ? prev.filter(x => x !== id) : [...prev, id];
      try {
        localStorage.setItem('stonks_pinned_notifications', JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const markAsRead = (id: string) => {
    notificationService.markAsRead(id);
  };

  const markAllAsRead = () => {
    notificationService.markAllAsRead();
  };

  const deleteNotification = (id: string) => {
    notificationService.deleteNotification(id);
    setPinnedIds(prev => prev.filter(x => x !== id));
  };

  const clearAll = () => {
    notificationService.clearAll();
    setPinnedIds([]);
  };

  const checkAndNotify = (report: DeterministicAnalysisReport) => {
    if (!report || !report.ticker) return;
    const isWatched = isFavorite(report.ticker);
    notificationService.checkAndNotify(report, isWatched);
  };

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        isOpen,
        isCollapsed,
        pinnedIds,
        setIsOpen,
        setIsCollapsed,
        toggleOpen,
        toggleCollapse,
        close,
        togglePin,
        markAsRead,
        markAllAsRead,
        deleteNotification,
        clearAll,
        checkAndNotify,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = (): NotificationContextType => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};
