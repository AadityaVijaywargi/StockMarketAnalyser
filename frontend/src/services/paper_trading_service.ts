import { apiClient } from './api';

/**
 * Thin client for the backend paper trading account (/paper/*). The backend
 * owns every rule - fills, P&L, target/stop exits, the bot - so nothing here
 * computes trading results; it only fetches and submits.
 */

export type PaperOwner = 'YOU' | 'BOT';
export type PaperSide = 'BUY' | 'SELL';
export type PaperReason = 'MANUAL' | 'TARGET' | 'STOP' | 'BOT_SIGNAL';

export interface PaperPosition {
  ticker: string;
  company_name: string;
  owner: PaperOwner;
  quantity: number;
  avg_cost: number;
  target: number | null;
  stop: number | null;
  opened_at: string;
  price: number | null;
  market_value: number;
  unrealized_pnl: number;
  unrealized_pnl_pct: number;
}

export interface PaperTrade {
  id: string;
  time: string;
  ticker: string;
  company_name: string;
  owner: PaperOwner;
  side: PaperSide;
  quantity: number;
  price: number;
  value: number;
  realized_pnl: number | null;
  reason: PaperReason;
  note: string | null;
}

export interface PaperSummary {
  starting_cash: number;
  cash: number;
  invested: number;
  market_value: number;
  equity: number;
  total_pnl: number;
  realized_pnl: Record<PaperOwner, number>;
  unrealized_pnl: Record<PaperOwner, number>;
  wins: Record<PaperOwner, number>;
  losses: Record<PaperOwner, number>;
}

export interface PaperBotLogEntry {
  time: string;
  ticker: string;
  action: 'BUY' | 'SKIP' | 'ERROR';
  message: string;
}

export interface PaperBotSettings {
  enabled: boolean;
  tickers: string[];
  budget_per_trade: number;
  max_positions: number;
  last_run_at: string | null;
  log?: PaperBotLogEntry[];
}

export interface PaperAccount {
  market_open: boolean;
  as_of: string;
  summary: PaperSummary;
  positions: PaperPosition[];
  recent_trades: PaperTrade[];
  bot: PaperBotSettings;
}

export interface PaperOrder {
  ticker: string;
  side: PaperSide;
  quantity: number;
  owner?: PaperOwner;
  target?: number | null;
  stop?: number | null;
  company_name?: string;
}

/** Fired after any successful change, so other mounted views refetch. */
export const PAPER_ACCOUNT_UPDATED_EVENT = 'stonks_paper_account_updated';

function notifyUpdated(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(PAPER_ACCOUNT_UPDATED_EVENT));
  }
}

/** The backend's human-readable 400 message, or a generic fallback. */
export function paperErrorMessage(err: unknown, fallback = 'Something went wrong. Please try again.'): string {
  const detail = (err as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail;
  if (typeof detail === 'string' && detail) return detail;
  if (Array.isArray(detail) && detail[0]?.msg) return String(detail[0].msg);
  return fallback;
}

export const paperTradingService = {
  async getAccount(): Promise<PaperAccount> {
    return (await apiClient.get('/paper/account')).data;
  },

  async placeOrder(order: PaperOrder): Promise<PaperTrade> {
    const body = { ...order };
    if (body.target == null) delete body.target;
    if (body.stop == null) delete body.stop;
    const trade = (await apiClient.post('/paper/orders', body)).data.trade;
    notifyUpdated();
    return trade;
  },

  async setLevels(owner: PaperOwner, ticker: string, target: number | null, stop: number | null): Promise<PaperPosition> {
    const res = await apiClient.put(
      `/paper/positions/${owner}/${encodeURIComponent(ticker)}/levels`,
      { target, stop },
    );
    notifyUpdated();
    return res.data.position;
  },

  async getHistory(limit = 200): Promise<PaperTrade[]> {
    return (await apiClient.get('/paper/history', { params: { limit } })).data.trades;
  },

  async downloadHistoryCsv(): Promise<Blob> {
    return (await apiClient.get('/paper/history.csv', { responseType: 'blob' })).data;
  },

  async getBot(): Promise<PaperBotSettings> {
    return (await apiClient.get('/paper/bot')).data.bot;
  },

  async updateBot(changes: Partial<Pick<PaperBotSettings, 'enabled' | 'tickers' | 'budget_per_trade' | 'max_positions'>>): Promise<PaperBotSettings> {
    const bot = (await apiClient.put('/paper/bot', changes)).data.bot;
    notifyUpdated();
    return bot;
  },

  async reset(): Promise<PaperAccount> {
    const account = (await apiClient.post('/paper/reset')).data;
    notifyUpdated();
    return account;
  },
};
