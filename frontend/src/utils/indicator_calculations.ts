// Technical Indicator Calculation Engine for Client-Side Charting

export interface IndicatorPoint {
  time: any;
  value: number;
}

export interface BollingerBandPoint {
  time: any;
  upper: number;
  middle: number;
  lower: number;
}

export interface MACDPoint {
  time: any;
  macd: number;
  signal: number;
  histogram: number;
}

export interface SuperTrendPoint {
  time: any;
  value: number;
  direction: 'UP' | 'DOWN';
}

/**
 * Calculates Simple Moving Average (SMA)
 */
export const calculateSMA = (times: any[], closes: number[], period: number): IndicatorPoint[] => {
  const result: IndicatorPoint[] = [];
  for (let i = period - 1; i < closes.length; i++) {
    let sum = 0;
    for (let j = 0; j < period; j++) {
      sum += closes[i - j];
    }
    result.push({
      time: times[i],
      value: Number((sum / period).toFixed(2)),
    });
  }
  return result;
};

/**
 * Calculates Exponential Moving Average (EMA)
 */
export const calculateEMA = (times: any[], closes: number[], period: number): IndicatorPoint[] => {
  const result: IndicatorPoint[] = [];
  if (closes.length < period) return result;

  const k = 2 / (period + 1);
  let ema = closes.slice(0, period).reduce((a, b) => a + b, 0) / period;

  result.push({
    time: times[period - 1],
    value: Number(ema.toFixed(2)),
  });

  for (let i = period; i < closes.length; i++) {
    ema = closes[i] * k + ema * (1 - k);
    result.push({
      time: times[i],
      value: Number(ema.toFixed(2)),
    });
  }
  return result;
};

/**
 * Calculates Relative Strength Index (RSI 14)
 */
export const calculateRSI = (times: any[], closes: number[], period: number = 14): IndicatorPoint[] => {
  const result: IndicatorPoint[] = [];
  if (closes.length <= period) return result;

  let gains = 0;
  let losses = 0;

  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) gains += diff;
    else losses -= diff;
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;

  let rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
  let rsi = 100 - 100 / (1 + rs);

  result.push({
    time: times[period],
    value: Number(rsi.toFixed(2)),
  });

  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    const gain = diff >= 0 ? diff : 0;
    const loss = diff < 0 ? -diff : 0;

    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;

    rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    rsi = 100 - 100 / (1 + rs);

    result.push({
      time: times[i],
      value: Number(rsi.toFixed(2)),
    });
  }

  return result;
};

/**
 * Calculates MACD (12, 26, 9)
 */
export const calculateMACD = (
  times: any[],
  closes: number[],
  fastPeriod: number = 12,
  slowPeriod: number = 26,
  signalPeriod: number = 9
): MACDPoint[] => {
  const emaFast = calculateEMA(times, closes, fastPeriod);
  const emaSlow = calculateEMA(times, closes, slowPeriod);

  const slowMap = new Map<any, number>();
  emaSlow.forEach(pt => slowMap.set(pt.time, pt.value));

  const macdLine: { time: any; value: number }[] = [];
  emaFast.forEach(pt => {
    if (slowMap.has(pt.time)) {
      macdLine.push({
        time: pt.time,
        value: Number((pt.value - slowMap.get(pt.time)!).toFixed(2)),
      });
    }
  });

  if (macdLine.length < signalPeriod) return [];

  const macdTimes = macdLine.map(pt => pt.time);
  const macdValues = macdLine.map(pt => pt.value);
  const signalLine = calculateEMA(macdTimes, macdValues, signalPeriod);

  const signalMap = new Map<any, number>();
  signalLine.forEach(pt => signalMap.set(pt.time, pt.value));

  const macdPoints: MACDPoint[] = [];
  macdLine.forEach(pt => {
    if (signalMap.has(pt.time)) {
      const sigVal = signalMap.get(pt.time)!;
      const hist = Number((pt.value - sigVal).toFixed(2));
      macdPoints.push({
        time: pt.time,
        macd: pt.value,
        signal: sigVal,
        histogram: hist,
      });
    }
  });

  return macdPoints;
};

/**
 * Calculates Bollinger Bands (20, 2 stdDev)
 */
export const calculateBollingerBands = (
  times: any[],
  closes: number[],
  period: number = 20,
  stdDevMult: number = 2
): BollingerBandPoint[] => {
  const result: BollingerBandPoint[] = [];
  for (let i = period - 1; i < closes.length; i++) {
    const slice = closes.slice(i - period + 1, i + 1);
    const mean = slice.reduce((a, b) => a + b, 0) / period;
    const variance = slice.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / period;
    const stdDev = Math.sqrt(variance);

    result.push({
      time: times[i],
      upper: Number((mean + stdDevMult * stdDev).toFixed(2)),
      middle: Number(mean.toFixed(2)),
      lower: Number((mean - stdDevMult * stdDev).toFixed(2)),
    });
  }
  return result;
};

/**
 * Calculates VWAP (Volume Weighted Average Price)
 */
export const calculateVWAP = (
  times: any[],
  highs: number[],
  lows: number[],
  closes: number[],
  volumes: number[]
): IndicatorPoint[] => {
  const result: IndicatorPoint[] = [];
  let cumVolume = 0;
  let cumPV = 0;

  for (let i = 0; i < closes.length; i++) {
    const typicalPrice = (highs[i] + lows[i] + closes[i]) / 3;
    const vol = volumes[i] || 1;
    cumPV += typicalPrice * vol;
    cumVolume += vol;

    const vwap = cumVolume === 0 ? typicalPrice : cumPV / cumVolume;
    result.push({
      time: times[i],
      value: Number(vwap.toFixed(2)),
    });
  }
  return result;
};

/**
 * Calculates SuperTrend (10, 3)
 */
export const calculateSuperTrend = (
  times: any[],
  highs: number[],
  lows: number[],
  closes: number[],
  period: number = 10,
  multiplier: number = 3
): SuperTrendPoint[] => {
  const result: SuperTrendPoint[] = [];
  if (closes.length <= period) return result;

  // Calculate True Range (TR)
  const tr: number[] = [highs[0] - lows[0]];
  for (let i = 1; i < closes.length; i++) {
    const trVal = Math.max(
      highs[i] - lows[i],
      Math.abs(highs[i] - closes[i - 1]),
      Math.abs(lows[i] - closes[i - 1])
    );
    tr.push(trVal);
  }

  // Calculate ATR
  let atr = tr.slice(0, period).reduce((a, b) => a + b, 0) / period;
  const atrs: number[] = new Array(period - 1).fill(0);
  atrs.push(atr);

  for (let i = period; i < closes.length; i++) {
    atr = (atrs[i - 1] * (period - 1) + tr[i]) / period;
    atrs.push(atr);
  }

  // SuperTrend Computation
  let isUp = true;
  let prevUpper = 0;
  let prevLower = 0;

  for (let i = period - 1; i < closes.length; i++) {
    const hl2 = (highs[i] + lows[i]) / 2;
    const curAtr = atrs[i];

    let basicUpper = hl2 + multiplier * curAtr;
    let basicLower = hl2 - multiplier * curAtr;

    let upper = basicUpper < prevUpper || closes[i - 1] > prevUpper ? basicUpper : prevUpper;
    let lower = basicLower > prevLower || closes[i - 1] < prevLower ? basicLower : prevLower;

    if (isUp) {
      if (closes[i] < lower) {
        isUp = false;
      }
    } else {
      if (closes[i] > upper) {
        isUp = true;
      }
    }

    const stVal = isUp ? lower : upper;
    result.push({
      time: times[i],
      value: Number(stVal.toFixed(2)),
      direction: isUp ? 'UP' : 'DOWN',
    });

    prevUpper = upper;
    prevLower = lower;
  }

  return result;
};
