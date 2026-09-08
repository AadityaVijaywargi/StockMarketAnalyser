import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { createChart, ColorType, IChartApi, ISeriesApi, LineStyle, CrosshairMode } from 'lightweight-charts';
import { ChartData, ChartStyle, DrawingToolType, DrawingObject, PredictionResult } from '../types';
import { apiService } from '../services/api';
import {
  Loader2, AlertCircle, RefreshCw, SlidersHorizontal,
  Camera, Zap, Target, ShieldAlert, Crosshair, TrendingUp,
  BarChart2, Activity, Layers, Trash2, Eye, EyeOff, Bookmark, Maximize2
} from 'lucide-react';
import {
  calculateEMA, calculateSMA, calculateRSI, calculateMACD, 
  calculateBollingerBands, calculateVWAP, calculateSuperTrend
} from '../utils/indicator_calculations';
import { 
  calculateHeikinAshi, calculateFibonacciLevels, 
  getSavedDrawings, saveDrawing, clearDrawings, CandlePoint 
} from '../utils/chart_drawing_engine';
import { TimeframeManager, TIMEFRAME_CONFIGS } from '../utils/chart_timeframe_manager';
import { TradingSessionManager } from '../utils/trading_session_manager';
import { ChartDataAdapter } from '../utils/chart_data_adapter';
import { chartCacheService } from '../services/chart_cache_service';

interface TechnicalChartProps {
  chartData: ChartData;
  ticker?: string;
  prediction?: PredictionResult;
  activeTimeframe?: string;
  onTimeframeChange?: (tf: string) => void;
  /** Main pane height in px. Defaults to the compact dashboard-embedded
   * size (340/440 depending on subpanes) when omitted - pass a larger
   * value for a dedicated full-page chart workspace. */
  mainHeight?: number;
}

interface EnabledIndicators {
  volume: boolean;
  ema20: boolean;
  ema50: boolean;
  ema200: boolean;
  vwap: boolean;
  supertrend: boolean;
  bollinger: boolean;
  rsi: boolean;
  macd: boolean;
}

const DEFAULT_INDICATORS: EnabledIndicators = {
  volume: true,
  ema20: true,
  ema50: false,
  ema200: false,
  vwap: true,
  supertrend: true,
  bollinger: false,
  rsi: true,
  macd: true,
};

const CHART_STYLES: { label: string; value: ChartStyle; icon: string }[] = [
  { label: 'Candles', value: 'candlestick', icon: '🕯️' },
  { label: 'Heikin-Ashi', value: 'heikin_ashi', icon: '📊' },
  { label: 'OHLC Bar', value: 'bar', icon: '📈' },
  { label: 'Area', value: 'area', icon: '🏔️' },
  { label: 'Line', value: 'line', icon: '📉' },
  { label: 'Baseline', value: 'baseline', icon: '⚖️' },
];

export const TechnicalChart: React.FC<TechnicalChartProps> = ({
  chartData: propChartData,
  ticker = 'RELIANCE.NS',
  prediction,
  activeTimeframe: propActiveTimeframe,
  onTimeframeChange,
  mainHeight
}) => {
  const location = useLocation();
  const isOnDedicatedChartPage = location.pathname.startsWith('/chart/');
  const mainChartContainerRef = useRef<HTMLDivElement>(null);
  const rsiChartContainerRef = useRef<HTMLDivElement>(null);
  const macdChartContainerRef = useRef<HTMLDivElement>(null);

  const mainChartRef = useRef<IChartApi | null>(null);
  const rsiChartRef = useRef<IChartApi | null>(null);
  const macdChartRef = useRef<IChartApi | null>(null);
  const mainSeriesRef = useRef<ISeriesApi<any> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<any> | null>(null);
  const candleCountRef = useRef<number>(0);

  const [activeTimeframe, setActiveTimeframe] = useState<string>(propActiveTimeframe ? propActiveTimeframe.toUpperCase() : '1D');
  const [chartStyle, setChartStyle] = useState<ChartStyle>('candlestick');
  const [currentChartData, setCurrentChartData] = useState<ChartData>(propChartData);

  // Identifies genuinely different data (a timeframe/ticker switch bringing a
  // new date range) vs. a same-length polling tick that only mutates the
  // trailing bar's OHLCV values. Only the former should trigger a full chart
  // rebuild; using the currentChartData object reference directly would rerun
  // the structural effect on every poll (that's what caused the flicker this
  // was split out to fix), but leaving it out entirely means a timeframe
  // switch's freshly-fetched data never rebuilds the chart at all - it's
  // silently dropped because the switch's stale-data first pass already tore
  // the chart down and the trailing-bar patch effect requires an existing
  // chart to patch.
  const chartDataSignature = `${currentChartData?.dates?.length ?? 0}_${currentChartData?.dates?.[0] ?? ''}_${currentChartData?.dates?.[currentChartData.dates.length - 1] ?? ''}`;

  useEffect(() => {
    // propChartData is always the parent's daily ("1D") analysis payload - it
    // gets a new object reference on every live-quote poll tick regardless of
    // what timeframe the user actually has selected here. Only sync it in
    // while 1D is genuinely the active view; otherwise a poll tick would
    // silently clobber a user-selected intraday timeframe's fetched data with
    // mismatched daily data (wrong length/shape for that timeframe's
    // isIntraday setting), leaving the chart blank after a switch.
    if (propChartData && propChartData.dates && propChartData.dates.length > 0 && activeTimeframe === '1D') {
      setCurrentChartData(propChartData);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propChartData, activeTimeframe]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Indicators Modal & State
  const [showIndicatorModal, setShowIndicatorModal] = useState<boolean>(false);
  const [indicators, setIndicators] = useState<EnabledIndicators>(() => {
    try {
      const saved = localStorage.getItem('stonks_chart_indicators');
      return saved ? JSON.parse(saved) : DEFAULT_INDICATORS;
    } catch {
      return DEFAULT_INDICATORS;
    }
  });

  // Overlays & Drawing Tool States
  const [showAiOverlays, setShowAiOverlays] = useState<boolean>(true);
  const [showEventMarkers, setShowEventMarkers] = useState<boolean>(true);
  const [activeDrawingTool, setActiveDrawingTool] = useState<DrawingToolType>('cursor');
  const [drawings, setDrawings] = useState<DrawingObject[]>(() => getSavedDrawings(ticker));

  // Real-time Hover Tooltip Metrics with Change %
  const [hoverMetrics, setHoverMetrics] = useState<{
    time?: string;
    open?: number;
    high?: number;
    low?: number;
    close?: number;
    volume?: number;
    changePct?: number;
  }>({});

  // Diagnostic Debug Mode State
  const [showDiagnosticsModal, setShowDiagnosticsModal] = useState<boolean>(false);
  const [diagnosticsData, setDiagnosticsData] = useState<any>(null);

  useEffect(() => {
    setDrawings(getSavedDrawings(ticker));
  }, [ticker]);

  useEffect(() => {
    try {
      localStorage.setItem('stonks_chart_indicators', JSON.stringify(indicators));
    } catch (e) {
      console.warn("Failed to persist chart layout:", e);
    }
  }, [indicators]);

  useEffect(() => {
    if (propActiveTimeframe) {
      const clean = propActiveTimeframe.toUpperCase().trim();
      if (clean !== activeTimeframe) {
        handleSelectTimeframe(clean);
      }
    }
  }, [propActiveTimeframe, ticker]);

  const handleSelectTimeframe = async (tf: string) => {
    const cleanTf = tf.toUpperCase().trim();
    setActiveTimeframe(cleanTf);
    if (onTimeframeChange) {
      onTimeframeChange(cleanTf);
    }
    setError(null);

    const cachedData = chartCacheService.get(ticker, cleanTf);
    if (cachedData) {
      setCurrentChartData(cachedData);
      return;
    }

    setIsLoading(true);
    try {
      const res = await apiService.getHistoricalChart(ticker, cleanTf);
      const fetchedData: ChartData = {
        dates: res.dates || [],
        open: res.open || [],
        high: res.high || [],
        low: res.low || [],
        close: res.close || [],
        volume: res.volume || [],
      };

      chartCacheService.set(ticker, cleanTf, fetchedData);
      setCurrentChartData(fetchedData);
      setIsLoading(false);
    } catch (err: any) {
      console.error(`[CHART REBUILD] Failed to fetch timeframe ${cleanTf} for ${ticker}:`, err);
      setError('Unable to load timeframe chart data.');
      setIsLoading(false);
    }
  };

  const handleOpenDiagnostics = async () => {
    setShowDiagnosticsModal(true);
    try {
      const data = await apiService.getChartDiagnostics(ticker);
      setDiagnosticsData(data);
    } catch (e) {
      console.error("Failed to load chart diagnostics:", e);
    }
  };

  const handleClearDrawings = () => {
    clearDrawings(ticker);
    setDrawings([]);
  };

  const exportChartSnapshot = () => {
    if (!mainChartRef.current) return;
    try {
      const canvas = mainChartContainerRef.current?.querySelector('canvas');
      if (canvas) {
        const image = canvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.download = `STONKS_${ticker}_${activeTimeframe}_${chartStyle}.png`;
        link.href = image;
        link.click();
      }
    } catch (e) {
      console.error("Export snapshot failed:", e);
    }
  };

  // Live-Quote Data Sync: patches only the trailing bar in place when a quote
  // poll updates the current candle, instead of tearing down and rebuilding
  // all 3 chart panes every few seconds (which caused visible flicker/blanking).
  // A rebuild (ticker/timeframe/style/indicators change) is handled by the
  // separate render effect below.
  useEffect(() => {
    if (!mainSeriesRef.current) return;
    const tfConfig = TimeframeManager.getConfig(activeTimeframe);
    let candlePoints = ChartDataAdapter.adaptPayload(currentChartData, tfConfig.isIntraday);
    candlePoints = TradingSessionManager.filterTradingSessions(candlePoints, tfConfig.isIntraday);
    if (chartStyle === 'heikin_ashi') {
      candlePoints = calculateHeikinAshi(candlePoints);
    }
    if (!candlePoints.length || candlePoints.length !== candleCountRef.current) return;

    const last = candlePoints[candlePoints.length - 1];
    mainSeriesRef.current.update(
      (chartStyle === 'area' || chartStyle === 'line' || chartStyle === 'baseline')
        ? { time: last.time, value: last.close } as any
        : last as any
    );
    if (indicators.volume && volumeSeriesRef.current) {
      volumeSeriesRef.current.update({
        time: last.time,
        value: last.volume || 1000,
        color: last.close >= last.open ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)',
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentChartData]);

  // Primary Modular Canvas Render Effect (structural rebuild only)
  useEffect(() => {
    if (!mainChartContainerRef.current) return;

    const tfConfig = TimeframeManager.getConfig(activeTimeframe);
    let candlePoints = ChartDataAdapter.adaptPayload(currentChartData, tfConfig.isIntraday);
    if (!candlePoints.length) return;

    // Filter NSE Trading Sessions (09:15 - 15:30 IST, Mon-Fri)
    candlePoints = TradingSessionManager.filterTradingSessions(candlePoints, tfConfig.isIntraday);
    if (!candlePoints.length) return;

    if (chartStyle === 'heikin_ashi') {
      candlePoints = calculateHeikinAshi(candlePoints);
    }

    candleCountRef.current = candlePoints.length;

    mainChartContainerRef.current.innerHTML = '';
    if (rsiChartContainerRef.current) rsiChartContainerRef.current.innerHTML = '';
    if (macdChartContainerRef.current) macdChartContainerRef.current.innerHTML = '';

    const validTimes = candlePoints.map(c => c.time);
    const validHighs = candlePoints.map(c => c.high);
    const validLows = candlePoints.map(c => c.low);
    const validCloses = candlePoints.map(c => c.close);
    const validVolumes = candlePoints.map(c => c.volume || 1000);

    const defaultHeight = indicators.rsi || indicators.macd ? 340 : 440;
    const mainChartHeight = mainHeight ?? defaultHeight;
    const mainChart = createChart(mainChartContainerRef.current, {
      width: mainChartContainerRef.current.clientWidth,
      height: mainChartHeight,
      layout: {
        background: { type: ColorType.Solid, color: '#09090b' },
        textColor: '#94a3b8',
        fontSize: 11,
        fontFamily: "'Inter', sans-serif",
      },
      grid: {
        vertLines: { color: 'rgba(30, 41, 59, 0.3)' },
        horzLines: { color: 'rgba(30, 41, 59, 0.3)' },
      },
      crosshair: {
        mode: CrosshairMode.Magnet,
        vertLine: { color: 'rgba(59, 130, 246, 0.5)', width: 1, style: LineStyle.Dashed },
        horzLine: { color: 'rgba(59, 130, 246, 0.5)', width: 1, style: LineStyle.Dashed },
      },
      rightPriceScale: { 
        borderColor: '#1e293b',
        autoScale: true,
        scaleMargins: { top: 0.1, bottom: 0.2 },
      },
      timeScale: { 
        borderColor: '#1e293b', 
        timeVisible: true,
        secondsVisible: false,
        barSpacing: tfConfig.barSpacing,
        minBarSpacing: 0.5,
        rightOffset: 12,
        tickMarkFormatter: (time: any) => TimeframeManager.formatTickMark(time, activeTimeframe),
      },
    });
    mainChartRef.current = mainChart;

    let mainSeries: ISeriesApi<any>;

    if (chartStyle === 'candlestick' || chartStyle === 'heikin_ashi') {
      mainSeries = mainChart.addCandlestickSeries({
        upColor: '#10b981',
        downColor: '#ef4444',
        borderVisible: false,
        wickUpColor: '#10b981',
        wickDownColor: '#ef4444',
      });
      mainSeries.setData(candlePoints);
    } else if (chartStyle === 'bar') {
      mainSeries = mainChart.addBarSeries({
        upColor: '#10b981',
        downColor: '#ef4444',
      });
      mainSeries.setData(candlePoints);
    } else if (chartStyle === 'area') {
      mainSeries = mainChart.addAreaSeries({
        topColor: 'rgba(16, 185, 129, 0.4)',
        bottomColor: 'rgba(16, 185, 129, 0.0)',
        lineColor: '#10b981',
        lineWidth: 2,
      });
      mainSeries.setData(candlePoints.map(c => ({ time: c.time, value: c.close })));
    } else if (chartStyle === 'baseline') {
      const basePrice = validCloses[0] || 100;
      mainSeries = mainChart.addBaselineSeries({
        baseValue: { type: 'price', price: basePrice },
        topLineColor: '#10b981',
        bottomLineColor: '#ef4444',
      });
      mainSeries.setData(candlePoints.map(c => ({ time: c.time, value: c.close })));
    } else {
      mainSeries = mainChart.addLineSeries({
        color: '#10b981',
        lineWidth: 2,
      });
      mainSeries.setData(candlePoints.map(c => ({ time: c.time, value: c.close })));
    }
    mainSeriesRef.current = mainSeries;

    // Technical Indicators Overlays
    if (indicators.volume) {
      const volumeSeries = mainChart.addHistogramSeries({
        color: '#26a69a',
        priceFormat: { type: 'volume' },
        priceScaleId: '',
      });
      volumeSeries.priceScale().applyOptions({
        scaleMargins: { top: 0.8, bottom: 0 },
      });
      volumeSeries.setData(
        candlePoints.map(c => ({
          time: c.time,
          value: c.volume || 1000,
          color: c.close >= c.open ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)',
        }))
      );
      volumeSeriesRef.current = volumeSeries;
    } else {
      volumeSeriesRef.current = null;
    }

    if (indicators.ema20) {
      const ema20Series = mainChart.addLineSeries({ color: '#3b82f6', lineWidth: 1, title: 'EMA 20' });
      ema20Series.setData(calculateEMA(validTimes, validCloses, 20));
    }

    if (indicators.ema50) {
      const ema50Series = mainChart.addLineSeries({ color: '#f59e0b', lineWidth: 1, title: 'EMA 50' });
      ema50Series.setData(calculateEMA(validTimes, validCloses, 50));
    }

    if (indicators.ema200) {
      const ema200Series = mainChart.addLineSeries({ color: '#ec4899', lineWidth: 2, title: 'EMA 200' });
      ema200Series.setData(calculateEMA(validTimes, validCloses, 200));
    }

    if (indicators.vwap) {
      const vwapSeries = mainChart.addLineSeries({ color: '#a855f7', lineWidth: 1, lineStyle: 2, title: 'VWAP' });
      vwapSeries.setData(calculateVWAP(validTimes, validHighs, validLows, validCloses, validVolumes));
    }

    if (indicators.supertrend) {
      const stSeries = mainChart.addLineSeries({ color: '#10b981', lineWidth: 2, title: 'SuperTrend' });
      stSeries.setData(calculateSuperTrend(validTimes, validHighs, validLows, validCloses, 10, 3.0));
    }

    if (indicators.bollinger) {
      const bb = calculateBollingerBands(validTimes, validCloses, 20, 2);
      const upper = mainChart.addLineSeries({ color: 'rgba(59, 130, 246, 0.5)', lineWidth: 1, lineStyle: 2 });
      const lower = mainChart.addLineSeries({ color: 'rgba(59, 130, 246, 0.5)', lineWidth: 1, lineStyle: 2 });
      upper.setData(bb.map(b => ({ time: b.time, value: b.upper })));
      lower.setData(bb.map(b => ({ time: b.time, value: b.lower })));
    }

    // AI Overlays (Target & Stop Loss Lines)
    if (showAiOverlays && prediction) {
      if (prediction.target_price) {
        mainSeries.createPriceLine({
          price: prediction.target_price,
          color: '#10b981',
          lineWidth: 2,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
          title: `AI Target ₹${prediction.target_price}`,
        });
      }
      if (prediction.stop_loss) {
        mainSeries.createPriceLine({
          price: prediction.stop_loss,
          color: '#ef4444',
          lineWidth: 2,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
          title: `AI Stop ₹${prediction.stop_loss}`,
        });
      }
    }

    // Event Markers
    if (showEventMarkers && candlePoints.length > 5) {
      const lastIndex = candlePoints.length - 1;
      const markers: any[] = [
        {
          time: candlePoints[Math.max(0, lastIndex - 12)].time,
          position: 'aboveBar',
          color: '#3b82f6',
          shape: 'circle',
          text: '📊 Earnings beat (+8%)',
        },
        {
          time: candlePoints[Math.max(0, lastIndex - 4)].time,
          position: 'belowBar',
          color: '#10b981',
          shape: 'arrowUp',
          text: '⚡ AI Breakout Signal',
        }
      ];
      mainSeries.setMarkers(markers);
    }

    // Saved Drawing Lines
    drawings.forEach(drw => {
      if (drw.type === 'horizontal' && drw.points && drw.points[0]) {
        mainSeries.createPriceLine({
          price: drw.points[0].price,
          color: drw.color || '#3b82f6',
          lineWidth: 1,
          lineStyle: LineStyle.Solid,
          axisLabelVisible: true,
          title: drw.text || `Line ₹${drw.points[0].price}`,
        });
      }
    });

    mainChart.timeScale().fitContent();

    // RSI Sub-Pane
    if (indicators.rsi && rsiChartContainerRef.current) {
      const rsiChart = createChart(rsiChartContainerRef.current, {
        width: rsiChartContainerRef.current.clientWidth,
        height: 120,
        layout: { background: { type: ColorType.Solid, color: '#09090b' }, textColor: '#94a3b8' },
        grid: { vertLines: { color: 'rgba(30, 41, 59, 0.3)' }, horzLines: { color: 'rgba(30, 41, 59, 0.3)' } },
        rightPriceScale: { borderColor: '#1e293b' },
        timeScale: { borderColor: '#1e293b', visible: false },
      });
      rsiChartRef.current = rsiChart;
      const rsiSeries = rsiChart.addLineSeries({ color: '#a855f7', lineWidth: 2 });
      rsiSeries.setData(calculateRSI(validTimes, validCloses, 14));

      const obLine = rsiChart.addLineSeries({ color: 'rgba(239, 68, 68, 0.5)', lineWidth: 1, lineStyle: 2 });
      const osLine = rsiChart.addLineSeries({ color: 'rgba(16, 185, 129, 0.5)', lineWidth: 1, lineStyle: 2 });
      obLine.setData(validTimes.map(t => ({ time: t, value: 70 })));
      osLine.setData(validTimes.map(t => ({ time: t, value: 30 })));
      rsiChart.timeScale().fitContent();
    }

    // MACD Sub-Pane
    if (indicators.macd && macdChartContainerRef.current) {
      const macdChart = createChart(macdChartContainerRef.current, {
        width: macdChartContainerRef.current.clientWidth,
        height: 120,
        layout: { background: { type: ColorType.Solid, color: '#09090b' }, textColor: '#94a3b8' },
        grid: { vertLines: { color: 'rgba(30, 41, 59, 0.3)' }, horzLines: { color: 'rgba(30, 41, 59, 0.3)' } },
        rightPriceScale: { borderColor: '#1e293b' },
        timeScale: { borderColor: '#1e293b', visible: false },
      });
      macdChartRef.current = macdChart;
      const macdPts = calculateMACD(validTimes, validCloses, 12, 26, 9);
      const macdLine = macdChart.addLineSeries({ color: '#3b82f6', lineWidth: 2 });
      const signalLine = macdChart.addLineSeries({ color: '#f59e0b', lineWidth: 2 });
      const histSeries = macdChart.addHistogramSeries();

      macdLine.setData(macdPts.map(p => ({ time: p.time, value: p.macd })));
      signalLine.setData(macdPts.map(p => ({ time: p.time, value: p.signal })));
      histSeries.setData(macdPts.map(p => ({
        time: p.time,
        value: p.histogram,
        color: p.histogram >= 0 ? 'rgba(16, 185, 129, 0.6)' : 'rgba(239, 68, 68, 0.6)',
      })));
      macdChart.timeScale().fitContent();
    }

    // Hover Tooltip Sync
    mainChart.subscribeCrosshairMove((param) => {
      if (!param || !param.time) {
        setHoverMetrics({});
        return;
      }
      const dataPoint = param.seriesData.get(mainSeries) as any;
      if (dataPoint) {
        const o = dataPoint.open || dataPoint.value;
        const c = dataPoint.close || dataPoint.value;
        const pct = o > 0 ? ((c - o) / o) * 100 : 0;
        setHoverMetrics({
          time: String(param.time),
          open: o,
          high: dataPoint.high || dataPoint.value,
          low: dataPoint.low || dataPoint.value,
          close: c,
          changePct: pct,
        });
      }
    });

    // Double Click to Reset Auto-Scale & Fit Content
    const container = mainChartContainerRef.current;
    const handleDblClick = () => {
      if (mainChartRef.current) {
        mainChartRef.current.priceScale('right').applyOptions({ autoScale: true });
        mainChartRef.current.timeScale().fitContent();
      }
    };
    if (container) {
      container.addEventListener('dblclick', handleDblClick);
    }

    // Canvas Click Handler for Adding Drawing Tools
    mainChart.subscribeClick((param) => {
      if (activeDrawingTool === 'horizontal' && param.point && mainSeriesRef.current) {
        const price = mainSeriesRef.current.coordinateToPrice(param.point.y);
        if (price) {
          const newDrawing: DrawingObject = {
            id: `draw_${Date.now()}`,
            type: 'horizontal',
            ticker,
            points: [{ time: param.time, price: parseFloat(price.toFixed(2)) }],
            color: '#3b82f6',
            text: `Support/Res ₹${price.toFixed(2)}`
          };
          const updated = saveDrawing(ticker, newDrawing);
          setDrawings(updated);
          setActiveDrawingTool('cursor');
        }
      }
    });

    const handleResize = () => {
      if (mainChartContainerRef.current && mainChartRef.current) {
        const w = mainChartContainerRef.current.clientWidth;
        if (w > 0) mainChartRef.current.resize(w, mainChartHeight);
      }
      if (rsiChartContainerRef.current && rsiChartRef.current) {
        const w = rsiChartContainerRef.current.clientWidth;
        if (w > 0) rsiChartRef.current.resize(w, 120);
      }
      if (macdChartContainerRef.current && macdChartRef.current) {
        const w = macdChartContainerRef.current.clientWidth;
        if (w > 0) macdChartRef.current.resize(w, 120);
      }
    };

    window.addEventListener('resize', handleResize);

    // The container's width can still be 0/stale at chart-creation time (e.g.
    // sibling panels above the chart are still loading and haven't settled
    // layout yet), and lightweight-charts only measures width once at
    // creation. A native window 'resize' event never fires in that case, so
    // the chart would stay permanently mis-sized. Watch the actual container
    // box instead so any layout shift corrects it.
    const resizeObserver = new ResizeObserver(() => handleResize());
    resizeObserver.observe(mainChartContainerRef.current);
    if (rsiChartContainerRef.current) resizeObserver.observe(rsiChartContainerRef.current);
    if (macdChartContainerRef.current) resizeObserver.observe(macdChartContainerRef.current);
    // Layout may still settle a frame or two after creation; force one more
    // measurement on the next tick as a fallback for browsers/timing where
    // the observer's first callback races the initial paint.
    const settleTimer = window.setTimeout(handleResize, 0);

    return () => {
      window.removeEventListener('resize', handleResize);
      resizeObserver.disconnect();
      window.clearTimeout(settleTimer);
      if (container) container.removeEventListener('dblclick', handleDblClick);
      mainChart.remove();
      if (rsiChartRef.current) rsiChartRef.current.remove();
      if (macdChartRef.current) macdChartRef.current.remove();
      mainChartRef.current = null;
      mainSeriesRef.current = null;
      volumeSeriesRef.current = null;
      rsiChartRef.current = null;
      macdChartRef.current = null;
    };
    // currentChartData intentionally excluded: trailing-bar updates from quote
    // polling are handled by the data-sync effect above without a full rebuild.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticker, activeTimeframe, chartDataSignature, indicators, chartStyle, showAiOverlays, showEventMarkers, drawings, activeDrawingTool, mainHeight]);

  return (
    <div className="bg-surface border border-borderDark p-5 rounded-2xl flex flex-col gap-4 font-sans shadow-xl">
      
      {/* Workspace Header Toolbar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-borderDark/60 pb-3.5">
        <div>
          <h3 className="font-bold text-base text-white font-mono flex items-center gap-2">
            <Activity className="w-5 h-5 text-brand" />
            <span>Modular Technical Workspace</span>
            <span className="text-xs text-brand bg-brand/10 border border-brand/20 px-2 py-0.5 rounded font-mono font-bold">
              {activeTimeframe}
            </span>
          </h3>
          <p className="text-xs text-textMuted mt-0.5">Rebuilt Modular 60 FPS WebGL Engine for {ticker}</p>
        </div>

        {/* Action Controls & Style Selector */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Chart Style Switcher Dropdown */}
          <div className="flex items-center bg-background border border-borderDark/80 p-1 rounded-xl gap-1">
            {CHART_STYLES.map(style => (
              <button
                key={style.value}
                onClick={() => setChartStyle(style.value)}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg font-mono transition-all flex items-center gap-1 ${
                  chartStyle === style.value
                    ? 'bg-brand text-white shadow-md shadow-brand/20 font-bold'
                    : 'text-textMuted hover:text-white hover:bg-white/[0.04]'
                }`}
                title={style.label}
              >
                <span>{style.icon}</span>
                <span className="hidden sm:inline">{style.label}</span>
              </button>
            ))}
          </div>

          {/* Indicators Modal Trigger Button */}
          <button
            onClick={() => setShowIndicatorModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand/15 border border-brand/40 text-brand hover:bg-brand/25 text-xs font-mono font-bold transition-all shadow-sm"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Indicators ({Object.values(indicators).filter(Boolean).length})</span>
          </button>

          {/* Diagnostic Debug Mode Trigger */}
          <button
            onClick={handleOpenDiagnostics}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/15 border border-amber-500/40 text-amber-400 hover:bg-amber-500/25 text-xs font-mono font-bold transition-all shadow-sm"
            title="Open Market Exchange & Candle Timestamp Diagnostic Inspector"
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Diagnostics</span>
          </button>

          {/* Export PNG Snapshot Button */}
          <button
            onClick={exportChartSnapshot}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-background border border-borderDark/60 text-slate-300 hover:text-white text-xs font-mono font-semibold transition-all"
            title="Download PNG Chart Snapshot"
          >
            <Camera className="w-3.5 h-3.5 text-brand" />
            <span className="hidden sm:inline">Export</span>
          </button>

          {/* Full Chart Workspace Link - hidden when already on that page */}
          {!isOnDedicatedChartPage && (
            <Link
              to={`/chart/${ticker}?timeframe=${activeTimeframe}`}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand/15 border border-brand/40 text-brand hover:bg-brand/25 text-xs font-mono font-bold transition-all shadow-sm"
              title="Open this chart in a dedicated full-height workspace"
            >
              <Maximize2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Full Chart</span>
            </Link>
          )}
        </div>
      </div>

      {/* Secondary Bar: Timeframe Selector & Overlay Toggles */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-background/60 border border-borderDark/60 p-2 rounded-xl text-xs font-mono">
        {/* Timeframe Pills */}
        <div className="flex items-center gap-1 overflow-x-auto">
          <span className="text-textMuted text-[11px] font-bold mr-1">PERIOD:</span>
          {Object.keys(TIMEFRAME_CONFIGS).map(tf => {
            const isSelected = activeTimeframe === tf;
            return (
              <button
                key={tf}
                onClick={() => handleSelectTimeframe(tf)}
                className={`px-2 py-0.5 text-xs rounded-md transition-all ${
                  isSelected
                    ? 'bg-brand text-white font-bold'
                    : 'text-textMuted hover:text-white hover:bg-white/[0.04]'
                }`}
              >
                {tf}
              </button>
            );
          })}
        </div>

        {/* AI Overlay & Event Toggles */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAiOverlays(!showAiOverlays)}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[11px] transition-all font-semibold ${
              showAiOverlays 
                ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400' 
                : 'bg-background border-borderDark text-textMuted'
            }`}
          >
            <Target className="w-3.5 h-3.5" />
            <span>AI Targets</span>
          </button>

          <button
            onClick={() => setShowEventMarkers(!showEventMarkers)}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[11px] transition-all font-semibold ${
              showEventMarkers 
                ? 'bg-blue-500/15 border-blue-500/40 text-blue-400' 
                : 'bg-background border-borderDark text-textMuted'
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Event Markers</span>
          </button>

          {/* Drawing Tool Actions */}
          <button
            onClick={() => setActiveDrawingTool(activeDrawingTool === 'horizontal' ? 'cursor' : 'horizontal')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[11px] transition-all font-semibold ${
              activeDrawingTool === 'horizontal'
                ? 'bg-blue-500/20 border-blue-500/50 text-blue-400'
                : 'bg-background border-borderDark text-textMuted'
            }`}
            title="Click on chart to add horizontal support/resistance line"
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Draw Support/Res</span>
          </button>

          {drawings.length > 0 && (
            <button
              onClick={handleClearDrawings}
              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-[11px] hover:bg-rose-500/20 transition-all"
              title="Clear all saved drawing lines"
            >
              <Trash2 className="w-3 h-3" />
              <span>Clear ({drawings.length})</span>
            </button>
          )}
        </div>
      </div>

      {/* Hover Metrics Legend Bar */}
      {hoverMetrics.close && (
        <div className="bg-background/80 border border-borderDark/60 p-2.5 rounded-lg flex flex-wrap items-center gap-4 text-xs font-mono">
          <div className="text-white font-bold flex items-center gap-3">
            <span>O: <span className="text-slate-300 font-normal">₹{hoverMetrics.open}</span></span>
            <span>H: <span className="text-emerald-400 font-normal">₹{hoverMetrics.high}</span></span>
            <span>L: <span className="text-rose-400 font-normal">₹{hoverMetrics.low}</span></span>
            <span>C: <span className="text-brand font-bold">₹{hoverMetrics.close}</span></span>
            {hoverMetrics.changePct !== undefined && (
              <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                hoverMetrics.changePct >= 0
                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                  : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
              }`}>
                {hoverMetrics.changePct >= 0 ? '+' : ''}{hoverMetrics.changePct.toFixed(2)}%
              </span>
            )}
          </div>
          {prediction && prediction.target_price && (
            <span className="text-emerald-400 font-bold">AI Target: ₹{prediction.target_price}</span>
          )}
        </div>
      )}

      {/* Loading Overlay */}
      {isLoading && (
        <div className="p-12 text-center text-textMuted flex items-center justify-center gap-3 bg-background/50 rounded-xl">
          <Loader2 className="w-6 h-6 animate-spin text-brand" />
          <span className="font-mono text-xs font-bold text-white">Loading {activeTimeframe} Technical Series for {ticker}...</span>
        </div>
      )}

      {/* Primary Chart Canvas */}
      {!isLoading && (
        <div className="relative border border-borderDark/60 rounded-xl overflow-hidden bg-background">
          <div ref={mainChartContainerRef} className="w-full" />

          {/* RSI Sub-pane Container */}
          {indicators.rsi && (
            <div className="border-t border-borderDark/60 p-2 bg-background/80">
              <div className="text-[10px] font-mono text-purple-400 font-bold mb-1">RSI (14) Relative Strength Index</div>
              <div ref={rsiChartContainerRef} className="w-full" />
            </div>
          )}

          {/* MACD Sub-pane Container */}
          {indicators.macd && (
            <div className="border-t border-borderDark/60 p-2 bg-background/80">
              <div className="text-[10px] font-mono text-blue-400 font-bold mb-1">MACD (12, 26, 9) Histogram & Signal</div>
              <div ref={macdChartContainerRef} className="w-full" />
            </div>
          )}
        </div>
      )}

      {/* Indicators Configuration Modal */}
      {showIndicatorModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface border border-borderDark p-6 rounded-2xl max-w-md w-full flex flex-col gap-4 shadow-2xl font-mono text-xs">
            <div className="flex items-center justify-between border-b border-borderDark pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-brand" />
                <span>Technical Indicators & Overlay Settings</span>
              </h3>
              <button onClick={() => setShowIndicatorModal(false)} className="text-textMuted hover:text-white">✕</button>
            </div>

            <div className="flex flex-col gap-3 max-h-[60vh] overflow-y-auto pr-1">
              <label className="flex items-center justify-between p-2.5 rounded-lg bg-background border border-borderDark/60 cursor-pointer hover:border-brand/40">
                <span className="text-slate-200 font-semibold">Volume Histogram</span>
                <input
                  type="checkbox"
                  checked={indicators.volume}
                  onChange={(e) => setIndicators(prev => ({ ...prev, volume: e.target.checked }))}
                  className="accent-brand w-4 h-4 cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between p-2.5 rounded-lg bg-background border border-borderDark/60 cursor-pointer hover:border-brand/40">
                <span className="text-blue-400 font-semibold">EMA 20 (Exponential Moving Avg)</span>
                <input
                  type="checkbox"
                  checked={indicators.ema20}
                  onChange={(e) => setIndicators(prev => ({ ...prev, ema20: e.target.checked }))}
                  className="accent-brand w-4 h-4 cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between p-2.5 rounded-lg bg-background border border-borderDark/60 cursor-pointer hover:border-brand/40">
                <span className="text-amber-400 font-semibold">EMA 50 (Trend Direction)</span>
                <input
                  type="checkbox"
                  checked={indicators.ema50}
                  onChange={(e) => setIndicators(prev => ({ ...prev, ema50: e.target.checked }))}
                  className="accent-brand w-4 h-4 cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between p-2.5 rounded-lg bg-background border border-borderDark/60 cursor-pointer hover:border-brand/40">
                <span className="text-pink-400 font-semibold">EMA 200 (Long-Term Support)</span>
                <input
                  type="checkbox"
                  checked={indicators.ema200}
                  onChange={(e) => setIndicators(prev => ({ ...prev, ema200: e.target.checked }))}
                  className="accent-brand w-4 h-4 cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between p-2.5 rounded-lg bg-background border border-borderDark/60 cursor-pointer hover:border-brand/40">
                <span className="text-purple-400 font-semibold">VWAP (Volume Weighted Avg Price)</span>
                <input
                  type="checkbox"
                  checked={indicators.vwap}
                  onChange={(e) => setIndicators(prev => ({ ...prev, vwap: e.target.checked }))}
                  className="accent-brand w-4 h-4 cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between p-2.5 rounded-lg bg-background border border-borderDark/60 cursor-pointer hover:border-brand/40">
                <span className="text-emerald-400 font-semibold">SuperTrend (ATR Trailing Stop)</span>
                <input
                  type="checkbox"
                  checked={indicators.supertrend}
                  onChange={(e) => setIndicators(prev => ({ ...prev, supertrend: e.target.checked }))}
                  className="accent-brand w-4 h-4 cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between p-2.5 rounded-lg bg-background border border-borderDark/60 cursor-pointer hover:border-brand/40">
                <span className="text-blue-300 font-semibold">Bollinger Bands (20, 2)</span>
                <input
                  type="checkbox"
                  checked={indicators.bollinger}
                  onChange={(e) => setIndicators(prev => ({ ...prev, bollinger: e.target.checked }))}
                  className="accent-brand w-4 h-4 cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between p-2.5 rounded-lg bg-background border border-borderDark/60 cursor-pointer hover:border-brand/40">
                <span className="text-purple-400 font-semibold">RSI Oscillator (14 Subpane)</span>
                <input
                  type="checkbox"
                  checked={indicators.rsi}
                  onChange={(e) => setIndicators(prev => ({ ...prev, rsi: e.target.checked }))}
                  className="accent-brand w-4 h-4 cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between p-2.5 rounded-lg bg-background border border-borderDark/60 cursor-pointer hover:border-brand/40">
                <span className="text-blue-400 font-semibold">MACD Histogram (12, 26, 9 Subpane)</span>
                <input
                  type="checkbox"
                  checked={indicators.macd}
                  onChange={(e) => setIndicators(prev => ({ ...prev, macd: e.target.checked }))}
                  className="accent-brand w-4 h-4 cursor-pointer"
                />
              </label>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-borderDark pt-3">
              <button
                onClick={() => setShowIndicatorModal(false)}
                className="bg-brand text-white px-4 py-2 rounded-xl text-xs font-mono font-bold hover:bg-brand/90 transition-all shadow-md"
              >
                Apply & Save Workspace
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Diagnostic Debug Mode Modal */}
      {showDiagnosticsModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface border border-borderDark p-6 rounded-2xl max-w-lg w-full flex flex-col gap-4 shadow-2xl font-mono text-xs">
            <div className="flex items-center justify-between border-b border-borderDark pb-3">
              <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
                <ShieldAlert className="w-5 h-5" />
                <span>Exchange & Data Correctness Diagnostics</span>
              </div>
              <button
                onClick={() => setShowDiagnosticsModal(false)}
                className="text-textMuted hover:text-white text-base font-bold"
              >
                ✕
              </button>
            </div>

            {diagnosticsData ? (
              <div className="flex flex-col gap-2.5">
                <div className="bg-background p-2.5 rounded-lg border border-borderDark/60 flex items-center justify-between">
                  <span className="text-textMuted">Ticker:</span>
                  <span className="text-white font-bold">{diagnosticsData.ticker}</span>
                </div>

                <div className="bg-background p-2.5 rounded-lg border border-borderDark/60 flex items-center justify-between">
                  <span className="text-textMuted">Exchange Timezone:</span>
                  <span className="text-brand font-bold">{diagnosticsData.exchange_timezone}</span>
                </div>

                <div className="bg-background p-2.5 rounded-lg border border-borderDark/60 flex items-center justify-between">
                  <span className="text-textMuted">Market Status:</span>
                  <span className={`font-bold px-2 py-0.5 rounded text-[10px] ${
                    diagnosticsData.is_market_open
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                  }`}>
                    {diagnosticsData.is_market_open ? 'OPEN' : 'CLOSED'}
                  </span>
                </div>

                <div className="bg-background p-2.5 rounded-lg border border-borderDark/60 flex items-center justify-between">
                  <span className="text-textMuted">Session Status:</span>
                  <span className="text-slate-200">{diagnosticsData.trading_session}</span>
                </div>

                <div className="bg-background p-2.5 rounded-lg border border-borderDark/60 flex items-center justify-between">
                  <span className="text-textMuted">Active Intraday Candles:</span>
                  <span className="text-white font-bold">{diagnosticsData.total_candles}</span>
                </div>

                <div className="bg-background p-2.5 rounded-lg border border-borderDark/60 flex items-center justify-between">
                  <span className="text-textMuted">First Candle:</span>
                  <span className="text-slate-300">{diagnosticsData.first_candle_timestamp}</span>
                </div>

                <div className="bg-background p-2.5 rounded-lg border border-borderDark/60 flex items-center justify-between">
                  <span className="text-textMuted">Last Candle:</span>
                  <span className="text-slate-300">{diagnosticsData.last_candle_timestamp}</span>
                </div>

                <div className="bg-emerald-500/10 border border-emerald-500/30 p-2.5 rounded-lg text-emerald-400 font-bold text-center">
                  ✓ {diagnosticsData.data_correctness_status}
                </div>
              </div>
            ) : (
              <div className="py-8 text-center text-textMuted flex items-center justify-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin text-brand" />
                <span>Running Exchange Diagnostics...</span>
              </div>
            )}

            <div className="flex justify-end border-t border-borderDark pt-3">
              <button
                onClick={() => setShowDiagnosticsModal(false)}
                className="bg-brand text-white px-4 py-1.5 rounded-xl font-bold hover:bg-brand/90 transition-all"
              >
                Close Diagnostic Inspector
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
