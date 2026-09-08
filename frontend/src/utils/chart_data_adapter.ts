import { ChartData } from '../types';
import { CandlePoint } from './chart_drawing_engine';

export class ChartDataAdapter {
  /**
   * Transforms raw API response payload arrays into strictly ascending,
   * deduplicated CandlePoint objects for Lightweight Charts.
   */
  static adaptPayload(data: ChartData, isIntraday: boolean): CandlePoint[] {
    const dates = data.dates || [];
    if (!dates.length) return [];

    const opens = data.open || [];
    const highs = data.high || [];
    const lows = data.low || [];
    const closes = data.close || [];
    const volumes = data.volume || [];

    const candleMap = new Map<any, CandlePoint>();

    dates.forEach((d, i) => {
      let timeVal: any = d;

      if (typeof d === 'number') {
        timeVal = d;
      } else if (typeof d === 'string') {
        if (isIntraday) {
          let isoStr = d.includes(' ') ? d.replace(' ', 'T') : d;
          if (!isoStr.includes('+') && !isoStr.includes('Z')) {
            isoStr += '+05:30'; // Explicit IST offset
          }
          const parsed = Date.parse(isoStr);
          timeVal = !isNaN(parsed) ? Math.floor(parsed / 1000) : d;
        } else {
          timeVal = d.split(' ')[0].split('T')[0];
        }
      }

      const point: CandlePoint = {
        time: timeVal,
        open: opens[i] ?? 0.0,
        high: highs[i] ?? 0.0,
        low: lows[i] ?? 0.0,
        close: closes[i] ?? 0.0,
        volume: volumes[i] ?? 1000
      };

      candleMap.set(timeVal, point);
    });

    // Sort strictly in ascending order by timestamp
    const sorted = Array.from(candleMap.values()).sort((a, b) => {
      if (typeof a.time === 'number' && typeof b.time === 'number') {
        return a.time - b.time;
      }
      return String(a.time).localeCompare(String(b.time));
    });

    return sorted;
  }
}
