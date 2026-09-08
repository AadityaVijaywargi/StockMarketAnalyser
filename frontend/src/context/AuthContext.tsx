import React, { createContext, useContext, useState, useEffect } from 'react';
import { apiService } from '../services/api';
import { watchlistService } from '../services/watchlist_service';
import { tradeStorageService } from '../services/trade_storage_service';

const TOKEN_KEY = 'stonks_auth_token';
const USERNAME_KEY = 'stonks_auth_username';
const ROLE_KEY = 'stonks_auth_role';

interface AuthContextType {
  isAuthenticated: boolean;
  username: string | null;
  role: string | null;
  isAdmin: boolean;
  login: (username: string, password: string) => Promise<void>;
  signup: (inviteCode: string, username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [username, setUsername] = useState<string | null>(() => localStorage.getItem(USERNAME_KEY));
  const [role, setRole] = useState<string | null>(() => localStorage.getItem(ROLE_KEY));

  const syncCloudData = () => {
    watchlistService.syncFromCloud();
    tradeStorageService.syncFromCloud();
  };

  // Returning user with a saved session: pull down anything saved from another device.
  useEffect(() => {
    if (token) syncCloudData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applySession = (data: { access_token: string; username: string; role: string }) => {
    localStorage.setItem(TOKEN_KEY, data.access_token);
    localStorage.setItem(USERNAME_KEY, data.username);
    localStorage.setItem(ROLE_KEY, data.role);
    setToken(data.access_token);
    setUsername(data.username);
    setRole(data.role);
    syncCloudData();
  };

  const login = async (usernameInput: string, password: string) => {
    const data = await apiService.login(usernameInput, password);
    applySession(data);
  };

  const signup = async (inviteCode: string, usernameInput: string, password: string) => {
    const data = await apiService.signup(inviteCode, usernameInput, password);
    applySession(data);
  };

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USERNAME_KEY);
    localStorage.removeItem(ROLE_KEY);
    setToken(null);
    setUsername(null);
    setRole(null);
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated: !!token, username, role, isAdmin: role === 'admin', login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};

export const getStoredToken = (): string | null => localStorage.getItem(TOKEN_KEY);

export const clearStoredAuth = (): void => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USERNAME_KEY);
  localStorage.removeItem(ROLE_KEY);
};
