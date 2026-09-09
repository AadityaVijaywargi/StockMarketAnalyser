import React, { createContext, useContext, useState, useEffect } from 'react';
import { WatchlistItem, MonitorHealthMetrics } from '../types';
import { watchlistService, WATCHLIST_UPDATED_EVENT } from '../services/watchlist_service';
import { watchlistMonitorService } from '../services/watchlist_monitor_service';

interface WatchlistContextType {
  watchlist: WatchlistItem[];
  isFavorite: (ticker: string) => boolean;
  toggleFavorite: (ticker: string, companyName?: string, currentPrice?: number) => void;
  addStock: (ticker: string, companyName?: string, currentPrice?: number) => void;
  removeStock: (ticker: string) => void;
  clearWatchlist: () => void;
  togglePin: (ticker: string) => void;
  updateNotes: (ticker: string, notes: string) => void;
  addTag: (ticker: string, tag: string) => void;
  removeTag: (ticker: string, tag: string) => void;
  getMonitorHealth: () => MonitorHealthMetrics;
}

const WatchlistContext = createContext<WatchlistContextType | undefined>(undefined);

export const WatchlistProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>(() => watchlistService.getWatchlist());

  useEffect(() => {
    // Start continuous background monitoring engine
    watchlistMonitorService.start();

    const handleUpdate = () => {
      setWatchlist(watchlistService.getWatchlist());
    };
    window.addEventListener(WATCHLIST_UPDATED_EVENT, handleUpdate);
    return () => {
      window.removeEventListener(WATCHLIST_UPDATED_EVENT, handleUpdate);
      watchlistMonitorService.stop();
    };
  }, []);

  const isFavorite = (ticker: string): boolean => {
    if (!ticker) return false;
    const clean = ticker.toUpperCase().trim();
    return watchlist.some(item => item.ticker.toUpperCase() === clean || item.id.toUpperCase() === clean);
  };

  const toggleFavorite = (ticker: string, companyName?: string, currentPrice?: number) => {
    watchlistService.toggleFavorite(ticker, companyName, currentPrice);
  };

  const addStock = (ticker: string, companyName?: string, currentPrice?: number) => {
    watchlistService.addStock(ticker, companyName, currentPrice);
  };

  const removeStock = (ticker: string) => {
    watchlistService.removeStock(ticker);
  };

  const clearWatchlist = () => {
    watchlistService.clearWatchlist();
  };

  const togglePin = (ticker: string) => {
    watchlistService.togglePin(ticker);
  };

  const updateNotes = (ticker: string, notes: string) => {
    watchlistService.updateNotes(ticker, notes);
  };

  const addTag = (ticker: string, tag: string) => {
    watchlistService.addTag(ticker, tag);
  };

  const removeTag = (ticker: string, tag: string) => {
    watchlistService.removeTag(ticker, tag);
  };

  return (
    <WatchlistContext.Provider
      value={{
        watchlist,
        isFavorite,
        toggleFavorite,
        addStock,
        removeStock,
        clearWatchlist,
        togglePin,
        updateNotes,
        addTag,
        removeTag,
        getMonitorHealth: () => watchlistMonitorService.getHealthMetrics(),
      }}
    >
      {children}
    </WatchlistContext.Provider>
  );
};

export const useWatchlist = (): WatchlistContextType => {
  const context = useContext(WatchlistContext);
  if (!context) {
    throw new Error('useWatchlist must be used within a WatchlistProvider');
  }
  return context;
};
