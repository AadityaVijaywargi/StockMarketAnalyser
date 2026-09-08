export interface TimeframeConfig {
  label: string;
  value: string;
  period: string;
  interval: string;
  isIntraday: boolean;
  barSpacing: number;
  labelFormat: 'HH:MM' | 'MMM DD' | 'MMM YYYY' | 'YYYY';
}

export const TIMEFRAME_CONFIGS: Record<string, TimeframeConfig> = {
  '5M': { label: '5M', value: '5M', period: '5d', interval: '5m', isIntraday: true, barSpacing: 12, labelFormat: 'HH:MM' },
  '10M': { label: '10M', value: '10M', period: '10d', interval: '15m', isIntraday: true, barSpacing: 10, labelFormat: 'HH:MM' },
  '30M': { label: '30M', value: '30M', period: '1mo', interval: '30m', isIntraday: true, barSpacing: 8, labelFormat: 'HH:MM' },
  '1D': { label: '1D', value: '1D', period: '1y', interval: '1d', isIntraday: false, barSpacing: 6, labelFormat: 'MMM DD' },
  '1W': { label: '1W', value: '1W', period: '5y', interval: '1wk', isIntraday: false, barSpacing: 6, labelFormat: 'MMM DD' },
  '1M': { label: '1M', value: '1M', period: 'max', interval: '1mo', isIntraday: false, barSpacing: 5, labelFormat: 'MMM YYYY' },
  '6M': { label: '6M', value: '6M', period: '6mo', interval: '1d', isIntraday: false, barSpacing: 6, labelFormat: 'MMM YYYY' },
  '1Y': { label: '1Y', value: '1Y', period: '1y', interval: '1d', isIntraday: false, barSpacing: 5, labelFormat: 'MMM YYYY' },
  '5Y': { label: '5Y', value: '5Y', period: '5y', interval: '1wk', isIntraday: false, barSpacing: 4, labelFormat: 'YYYY' },
  'MAX': { label: 'MAX', value: 'MAX', period: 'max', interval: '1mo', isIntraday: false, barSpacing: 3, labelFormat: 'YYYY' },
};

export class TimeframeManager {
  static getConfig(timeframe: string): TimeframeConfig {
    const clean = timeframe.toUpperCase().trim();
    return TIMEFRAME_CONFIGS[clean] || TIMEFRAME_CONFIGS['1D'];
  }

  static formatTickMark(time: any, timeframe: string): string {
    const config = TimeframeManager.getConfig(timeframe);
    let dateObj: Date | null = null;

    if (typeof time === 'number') {
      dateObj = new Date(time * 1000);
    } else if (typeof time === 'string') {
      const iso = time.includes(' ') ? time.replace(' ', 'T') : time;
      dateObj = new Date(iso);
    } else if (typeof time === 'object' && time !== null && 'year' in time) {
      dateObj = new Date(time.year, time.month - 1, time.day);
    }

    if (!dateObj || isNaN(dateObj.getTime())) {
      return String(time);
    }

    if (config.labelFormat === 'HH:MM') {
      return dateObj.toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: 'Asia/Kolkata'
      });
    }

    if (config.labelFormat === 'MMM DD') {
      return dateObj.toLocaleDateString('en-IN', {
        month: 'short',
        day: 'numeric',
        timeZone: 'Asia/Kolkata'
      });
    }

    if (config.labelFormat === 'MMM YYYY') {
      return dateObj.toLocaleDateString('en-IN', {
        month: 'short',
        year: '2-digit',
        timeZone: 'Asia/Kolkata'
      });
    }

    return dateObj.getFullYear().toString();
  }
}
