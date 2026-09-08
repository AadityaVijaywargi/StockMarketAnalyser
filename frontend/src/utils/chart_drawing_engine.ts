import { DrawingObject } from '../types';

export interface CandlePoint {
  time: any;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

/**
 * Calculates Heikin-Ashi candles from standard OHLC candle points.
 */
export function calculateHeikinAshi(candles: CandlePoint[]): CandlePoint[] {
  if (!candles || candles.length === 0) return [];

  const haCandles: CandlePoint[] = [];

  for (let i = 0; i < candles.length; i++) {
    const curr = candles[i];
    const haClose = (curr.open + curr.high + curr.low + curr.close) / 4;
    
    let haOpen: number;
    if (i === 0) {
      haOpen = (curr.open + curr.close) / 2;
    } else {
      const prevHa = haCandles[i - 1];
      haOpen = (prevHa.open + prevHa.close) / 2;
    }

    const haHigh = Math.max(curr.high, haOpen, haClose);
    const haLow = Math.min(curr.low, haOpen, haClose);

    haCandles.push({
      time: curr.time,
      open: parseFloat(haOpen.toFixed(2)),
      high: parseFloat(haHigh.toFixed(2)),
      low: parseFloat(haLow.toFixed(2)),
      close: parseFloat(haClose.toFixed(2)),
      volume: curr.volume
    });
  }

  return haCandles;
}

/**
 * Calculates Fibonacci Retracement Levels given high and low prices.
 * Key ratios: 0.0%, 23.6%, 38.2%, 50.0%, 61.8%, 78.6%, 100.0%
 */
export interface FibLevel {
  ratio: string;
  price: number;
  color: string;
}

export function calculateFibonacciLevels(high: number, low: number): FibLevel[] {
  const diff = high - low;
  if (diff <= 0) return [];

  return [
    { ratio: '0.0%', price: parseFloat(high.toFixed(2)), color: '#ef4444' },
    { ratio: '23.6%', price: parseFloat((high - diff * 0.236).toFixed(2)), color: '#f97316' },
    { ratio: '38.2%', price: parseFloat((high - diff * 0.382).toFixed(2)), color: '#eab308' },
    { ratio: '50.0%', price: parseFloat((high - diff * 0.500).toFixed(2)), color: '#3b82f6' },
    { ratio: '61.8%', price: parseFloat((high - diff * 0.618).toFixed(2)), color: '#10b981' },
    { ratio: '78.6%', price: parseFloat((high - diff * 0.786).toFixed(2)), color: '#8b5cf6' },
    { ratio: '100.0%', price: parseFloat(low.toFixed(2)), color: '#06b6d4' },
  ];
}

/**
 * LocalStorage helper for saving and loading user drawing objects per stock.
 */
const DRAWINGS_STORAGE_KEY = 'stonks_user_chart_drawings';

export function getSavedDrawings(ticker: string): DrawingObject[] {
  try {
    const raw = localStorage.getItem(DRAWINGS_STORAGE_KEY);
    if (!raw) return [];
    const parsed: Record<string, DrawingObject[]> = JSON.parse(raw);
    return parsed[ticker.toUpperCase().trim()] || [];
  } catch (e) {
    console.warn('Failed to load chart drawings from localStorage:', e);
    return [];
  }
}

export function saveDrawing(ticker: string, drawing: DrawingObject): DrawingObject[] {
  try {
    const raw = localStorage.getItem(DRAWINGS_STORAGE_KEY);
    const parsed: Record<string, DrawingObject[]> = raw ? JSON.parse(raw) : {};
    const key = ticker.toUpperCase().trim();
    const existing = parsed[key] || [];
    const updated = [...existing.filter(d => d.id !== drawing.id), drawing];
    parsed[key] = updated;
    localStorage.setItem(DRAWINGS_STORAGE_KEY, JSON.stringify(parsed));
    return updated;
  } catch (e) {
    console.warn('Failed to save chart drawing to localStorage:', e);
    return [];
  }
}

export function clearDrawings(ticker: string): void {
  try {
    const raw = localStorage.getItem(DRAWINGS_STORAGE_KEY);
    if (!raw) return;
    const parsed: Record<string, DrawingObject[]> = JSON.parse(raw);
    delete parsed[ticker.toUpperCase().trim()];
    localStorage.setItem(DRAWINGS_STORAGE_KEY, JSON.stringify(parsed));
  } catch (e) {
    console.warn('Failed to clear chart drawings:', e);
  }
}
