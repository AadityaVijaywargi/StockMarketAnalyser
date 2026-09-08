import { CandlePoint } from './chart_drawing_engine';

export interface MarketClockStatus {
  isOpen: boolean;
  sessionName: string;
  exchangeTimezone: string;
  localISTTime: string;
}

export class TradingSessionManager {
  /**
   * Filters candles strictly to official NSE equity trading sessions (Mon-Fri, 09:15:00 IST - 15:30:00 IST).
   * Prevents overnight & weekend candle leakage.
   */
  static filterTradingSessions(candles: CandlePoint[], isIntraday: boolean): CandlePoint[] {
    if (!candles || candles.length === 0) return [];
    if (!isIntraday) return candles;

    return candles.filter(c => {
      let d: Date;
      if (typeof c.time === 'number') {
        d = new Date(c.time * 1000);
      } else if (typeof c.time === 'string') {
        const isoStr = c.time.includes(' ') ? c.time.replace(' ', 'T') : c.time;
        d = new Date(isoStr);
      } else {
        return true;
      }

      if (isNaN(d.getTime())) return true;

      // Extract IST hours & minutes via UTC offset (+5h 30m)
      const istHours = (d.getUTCHours() + 5 + Math.floor((d.getUTCMinutes() + 30) / 60)) % 24;
      const istMinutes = (d.getUTCMinutes() + 30) % 60;
      const totalMins = istHours * 60 + istMinutes;

      // Regular NSE Session: 09:15 (555 mins) to 15:30 (930 mins)
      const isWithinHours = totalMins >= 555 && totalMins <= 930;
      return isWithinHours;
    });
  }

  /**
   * Evaluates current market open/closed status for NSE Equities.
   */
  static getMarketClockStatus(): MarketClockStatus {
    const now = new Date();
    const istHours = (now.getUTCHours() + 5 + Math.floor((now.getUTCMinutes() + 30) / 60)) % 24;
    const istMinutes = (now.getUTCMinutes() + 30) % 60;
    const totalMins = istHours * 60 + istMinutes;

    const day = now.getUTCDay(); // 0 = Sun, 6 = Sat
    const isWeekday = day >= 1 && day <= 5;
    const isTradingHours = totalMins >= 555 && totalMins <= 930;

    const isOpen = isWeekday && isTradingHours;

    return {
      isOpen,
      sessionName: isOpen ? 'Regular Trading Session (09:15 - 15:30 IST)' : 'Market Closed / Out of Session',
      exchangeTimezone: 'Asia/Kolkata',
      localISTTime: now.toISOString()
    };
  }
}
