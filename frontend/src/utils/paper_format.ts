import type { PaperReason, PaperSide } from '../services/paper_trading_service';

/** "+₹1,234.50" / "-₹1,234.50" / "₹0.00" - sign always explicit for P&L. */
export function formatSignedRupees(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '--';
  const abs = Math.abs(value).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (value > 0) return `+₹${abs}`;
  if (value < 0) return `-₹${abs}`;
  return `₹${abs}`;
}

export function pnlClass(value: number | null | undefined): string {
  if (!value) return 'text-slate-300';
  return value > 0 ? 'text-emerald-400' : 'text-rose-400';
}

export function reasonLabel(reason: PaperReason, side: PaperSide): string {
  switch (reason) {
    case 'TARGET': return 'Target hit';
    case 'STOP': return 'Stop-loss hit';
    case 'BOT_SIGNAL': return 'Bot: BUY signal';
    default: return side === 'BUY' ? 'Manual buy' : 'Manual sell';
  }
}

/**
 * Parses an optional price field. Empty → null (not set); a positive number
 * → that number; anything else → NaN so the form can flag it.
 */
export function parseOptionalPrice(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  return Number.isFinite(n) && n > 0 ? n : NaN;
}

export interface OrderCheck {
  side: PaperSide;
  quantity: number;
  /** Last price shown to the user; the real fill uses the live price at submit. */
  price: number | null;
  target: number | null;
  stop: number | null;
  cash: number;
  held: number;
}

/**
 * Early, friendly feedback for the order form. The backend re-checks
 * everything at the live price, so this is a hint, not the rule.
 */
export function orderProblem(o: OrderCheck): string | null {
  if (!Number.isInteger(o.quantity) || o.quantity < 1) return 'Enter a whole number of shares (at least 1).';
  if (o.side === 'SELL') {
    if (o.held < 1) return "You don't hold this stock.";
    if (o.quantity > o.held) return `You only hold ${o.held} shares.`;
    return null;
  }
  if (Number.isNaN(o.target)) return 'Target must be a positive number.';
  if (Number.isNaN(o.stop)) return 'Stop-loss must be a positive number.';
  if (o.price !== null) {
    if (o.target !== null && o.target <= o.price) return 'Target must be above the current price.';
    if (o.stop !== null && o.stop >= o.price) return 'Stop-loss must be below the current price.';
    if (o.quantity * o.price > o.cash) return 'Not enough cash for this order.';
  }
  return null;
}
