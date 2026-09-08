import React, { useState, useEffect, useRef } from 'react';
import { ArrowUpRight, ArrowDownRight, Clock, Star, TrendingUp, FileDown, Loader2 } from 'lucide-react';
import { DeterministicAnalysisReport, LiveQuote, ChartData } from '../types';
import { formatPrice, formatNumber, formatPercentage } from '../utils/formatter';
import { SearchBar } from './search/SearchBar';
import { useWatchlist } from '../context/WatchlistContext';
import { apiService } from '../services/api';
import { generateStockReportPdf } from '../services/pdf_report_service';

interface DashboardHeaderProps {
  report: DeterministicAnalysisReport;
  onSearch: (ticker: string) => void;
  isLoading: boolean;
  latestQuote?: LiveQuote | null;
  lastUpdated?: string | null;
  activeTimeframe?: string;
  onTimeframeChange?: (timeframe: string) => void;
}

export const DashboardHeader: React.FC<DashboardHeaderProps> = ({ 
  report, 
  onSearch, 
  isLoading,
  latestQuote,
  lastUpdated,
  activeTimeframe = '1D',
  onTimeframeChange
}) => {
  const { isFavorite: checkFavorite, toggleFavorite } = useWatchlist();
  const isFavorite = checkFavorite(report.ticker);
  const [isExporting, setIsExporting] = useState(false);

  const handleExportPdf = async () => {
    setIsExporting(true);
    try {
      generateStockReportPdf(report);
    } finally {
      setTimeout(() => setIsExporting(false), 400);
    }
  };

  const handleToggleFavorite = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleFavorite(report.ticker, report.company_name);
  };

  // Timeframe chart dataset state
  const [tfChartData, setTfChartData] = useState<ChartData>(report?.chart_data);
  const cacheRef = useRef<Record<string, ChartData>>({});

  // Sync / fetch chart data for active timeframe
  useEffect(() => {
    let isMounted = true;
    const cleanTf = activeTimeframe.toUpperCase().trim();
    if (cleanTf === '1D' || !report?.ticker) {
      setTfChartData(report?.chart_data);
      return;
    }

    const cacheKey = `${report.ticker}:${cleanTf}`;
    if (cacheRef.current[cacheKey]) {
      setTfChartData(cacheRef.current[cacheKey]);
      return;
    }

    apiService.getHistoricalChart(report.ticker, cleanTf)
      .then((data) => {
        if (isMounted && data && data.close && data.close.length > 0) {
          cacheRef.current[cacheKey] = data;
          setTfChartData(data);
        }
      })
      .catch((err) => {
        console.error('Failed to load timeframe data for header stats', err);
      });

    return () => {
      isMounted = false;
    };
  }, [report?.ticker, activeTimeframe, report?.chart_data]);

  // Extract candle arrays
  const activeCloses = tfChartData?.close || report?.chart_data?.close || [];
  const activeHighs = tfChartData?.high || report?.chart_data?.high || [];
  const activeLows = tfChartData?.low || report?.chart_data?.low || [];
  const activeVolumes = tfChartData?.volume || report?.chart_data?.volume || [];

  const tfUpper = activeTimeframe.toUpperCase().trim();
  const is1D = tfUpper === '1D';

  const currentPrice = latestQuote ? latestQuote.price : (activeCloses.length > 0 ? activeCloses[activeCloses.length - 1] : 0.0);
  const firstPrice = activeCloses.length > 0 ? activeCloses[0] : currentPrice;

  let change = 0.0;
  let changePct = 0.0;

  if (is1D) {
    change = latestQuote ? latestQuote.change : (activeCloses.length > 1 ? currentPrice - activeCloses[activeCloses.length - 2] : 0.0);
    changePct = latestQuote ? latestQuote.change_pct : (activeCloses.length > 1 && activeCloses[activeCloses.length - 2] > 0 ? (change / activeCloses[activeCloses.length - 2]) * 100 : 0.0);
  } else {
    change = currentPrice - firstPrice;
    changePct = firstPrice > 0 ? (change / firstPrice) * 100.0 : 0.0;
  }

  const isPositive = change >= 0;

  const high = is1D && latestQuote?.high 
    ? latestQuote.high 
    : (activeHighs.length > 0 ? Math.max(...activeHighs) : currentPrice);

  const low = is1D && latestQuote?.low 
    ? latestQuote.low 
    : (activeLows.length > 0 ? Math.min(...activeLows) : currentPrice);

  const totalVolume = activeVolumes.length > 0 
    ? activeVolumes.reduce((acc, val) => acc + val, 0) 
    : (latestQuote?.volume || 0);

  // CAGR calculation for multi-year timeframes (3Y, 5Y, MAX)
  let cagr: number | null = null;
  if (['3Y', '5Y', 'MAX'].includes(tfUpper) && firstPrice > 0 && currentPrice > 0) {
    let years = 3.0;
    if (tfUpper === '5Y') years = 5.0;
    if (tfUpper === 'MAX') years = Math.max(activeCloses.length / 252.0, 1.0);
    cagr = (Math.pow(currentPrice / firstPrice, 1.0 / years) - 1.0) * 100.0;
  }

  // Label Mapping according to requested timeframe
  const getHeaderLabels = () => {
    switch (tfUpper) {
      case '5M':
        return { returnLabel: '5M Scalp Change', highLabel: '5M High', lowLabel: '5M Low', volLabel: '5M Vol' };
      case '10M':
        return { returnLabel: '10M Momentum Change', highLabel: '10M High', lowLabel: '10M Low', volLabel: '10M Vol' };
      case '30M':
        return { returnLabel: '30M Intraday Return', highLabel: '30M High', lowLabel: '30M Low', volLabel: '30M Vol' };
      case '1W':
        return { returnLabel: '7-Day Return', highLabel: 'Weekly H', lowLabel: 'Weekly L', volLabel: '1W Vol' };
      case '1M':
        return { returnLabel: '1-Month Return', highLabel: 'Monthly H', lowLabel: 'Monthly L', volLabel: '1M Vol' };
      case '6M':
        return { returnLabel: '6-Month Return', highLabel: '6M High', lowLabel: '6M Low', volLabel: '6M Vol' };
      case '1Y':
        return { returnLabel: '1-Year Return', highLabel: '52W High', lowLabel: '52W Low', volLabel: '1Y Vol' };
      case '5Y':
        return { returnLabel: '5-Year Return', highLabel: '5Y High', lowLabel: '5Y Low', volLabel: '5Y Vol' };
      case 'MAX':
        return { returnLabel: 'Total Return', highLabel: 'All-Time H', lowLabel: 'All-Time L', volLabel: 'Max Vol' };
      case '1D':
      default:
        return { returnLabel: 'Today\'s Change', highLabel: 'H', lowLabel: 'L', volLabel: 'VOL' };
    }
  };

  const labels = getHeaderLabels();

  const isMarketOpen = latestQuote ? latestQuote.is_market_open : false;

  // 7-Level Probability-Driven Recommendation styles
  const recColors: Record<string, string> = {
    'STRONG BUY': 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 font-bold',
    'BUY': 'bg-bullish/20 text-bullish border-bullish/40 font-bold',
    'ACCUMULATE': 'bg-teal-500/20 text-teal-300 border-teal-500/40 font-bold',
    'HOLD': 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40 font-bold',
    'REDUCE': 'bg-orange-500/20 text-orange-400 border-orange-500/40 font-bold',
    'SELL': 'bg-bearish/20 text-bearish border-bearish/40 font-bold',
    'STRONG SELL': 'bg-rose-600/20 text-rose-400 border-rose-600/40 font-bold',
  };

  const activeRec = report.prediction?.recommendation || report.recommendation || report.scores?.recommendation || 'HOLD';

  // Risk profile styles
  const riskColors = {
    Low: 'text-bullish bg-bullish/5 border-bullish/10',
    Moderate: 'text-yellow-500 bg-yellow-500/5 border-yellow-500/10',
    High: 'text-orange-500 bg-orange-500/5 border-orange-500/10',
    'Very High': 'text-bearish bg-bearish/5 border-bearish/10',
  };

  const timeframes = [
    { label: '1D', value: '1D' },
    { label: '1W', value: '1W' },
    { label: '1M', value: '1M' },
    { label: '6M', value: '6M' },
    { label: '1Y', value: '1Y' },
    { label: '5Y', value: '5Y' },
    { label: 'MAX', value: 'MAX' },
  ];

  // Format volume for display
  const formatVol = (val: number) => {
    if (val >= 10000000) return `${(val / 10000000).toFixed(2)}Cr`;
    if (val >= 100000) return `${(val / 100000).toFixed(2)}L`;
    if (val >= 1000) return `${(val / 1000).toFixed(1)}k`;
    return val.toString();
  };

  return (
    <header className="border-b border-borderDark bg-[#090909]/85 p-6 flex flex-col xl:flex-row xl:items-center xl:justify-between gap-6 sticky top-0 z-40 backdrop-blur-md">
      {/* 1. Ticker and Price info */}
      <div className="flex flex-col gap-2.5">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-[11px] font-mono tracking-widest bg-brand/10 text-brand border border-brand/20 px-2 py-0.5 rounded">
            {report.ticker}
          </span>
          <h2 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <span>{report.company_name}</span>
            <button
              onClick={handleToggleFavorite}
              title={isFavorite ? "Remove from Watchlist" : "Add to Watchlist"}
              className="p-1 rounded-lg hover:bg-white/10 transition-all text-yellow-400 focus:outline-none"
            >
              <Star className={`w-5 h-5 ${isFavorite ? 'fill-yellow-400 text-yellow-400' : 'text-textMuted hover:text-yellow-400'}`} />
            </button>
          </h2>
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${recColors[activeRec] || recColors.HOLD}`}>
            {activeRec}
          </span>
          
          {/* Live Status indicator */}
          <div className="flex items-center gap-2 ml-2">
            <span className={`relative flex h-2 w-2`}>
              {isMarketOpen && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-bullish opacity-75"></span>
              )}
              <span className={`relative inline-flex rounded-full h-2 w-2 ${isMarketOpen ? 'bg-bullish' : 'bg-textMuted'}`}></span>
            </span>
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-textMuted">
              {isMarketOpen ? 'LIVE' : 'CLOSED'}
            </span>
          </div>

          {/* Last Updated Timestamp */}
          {lastUpdated && (
            <div className="flex items-center gap-1 text-[10px] font-mono text-textMuted ml-3 border-l border-borderDark pl-3">
              <Clock className="w-3.5 h-3.5" />
              <span>UPDATED: {lastUpdated}</span>
            </div>
          )}
        </div>
        
        {/* Price Row */}
        <div className="flex flex-wrap items-baseline gap-4 mt-0.5">
          <span className="text-3xl font-bold tracking-tight font-mono text-white">
            {formatPrice(currentPrice)}
          </span>
          
          <div className={`flex items-center text-sm font-semibold font-mono ${isPositive ? 'text-bullish' : 'text-bearish'}`}>
            {isPositive ? <ArrowUpRight className="w-4 h-4 mr-0.5" /> : <ArrowDownRight className="w-4 h-4 mr-0.5" />}
            <span>{isPositive ? '+' : ''}{formatNumber(change, 2)}</span>
            <span className="ml-1.5">({isPositive ? '+' : ''}{formatPercentage(changePct, 2)})</span>
            <span className="ml-2 text-[11px] font-sans font-normal text-textMuted uppercase">
              • {labels.returnLabel}
            </span>
          </div>

          {cagr !== null && (
            <div className="flex items-center gap-1 text-xs font-mono font-bold text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded">
              <TrendingUp className="w-3 h-3" />
              <span>CAGR: {formatPercentage(cagr, 2)}</span>
            </div>
          )}

          {/* High, Low, Volume Stats row */}
          <div className="flex items-center gap-3 text-xs text-textMuted font-mono border-l border-borderDark pl-4 ml-1">
            <span>{labels.highLabel}: <span className="text-white font-semibold">{formatPrice(high)}</span></span>
            <span>{labels.lowLabel}: <span className="text-white font-semibold">{formatPrice(low)}</span></span>
            <span>{labels.volLabel}: <span className="text-white font-semibold">{formatVol(totalVolume)}</span></span>
          </div>
        </div>
      </div>

      {/* 2. Controls and Search */}
      <div className="flex flex-wrap items-center gap-5">
        {/* Timeframe Selector Pills */}
        <div className="flex bg-[#141414] border border-borderDark p-1 rounded-lg">
          {timeframes.map((tf) => (
            <button
              key={tf.value}
              onClick={() => onTimeframeChange && onTimeframeChange(tf.value)}
              className={`px-3 py-1 text-xs font-semibold rounded-md font-mono transition-all ${
                activeTimeframe === tf.value
                  ? 'bg-brand text-white shadow-sm font-bold shadow-brand/20'
                  : 'text-textMuted hover:text-white hover:bg-white/[0.04]'
              }`}
            >
              {tf.label}
            </button>
          ))}
        </div>

        {/* Confidence & Risk info */}
        <div className="flex gap-2 shrink-0">
          <div className="flex flex-col bg-surface border border-borderDark px-3 py-1 rounded-lg text-center min-w-[75px]">
            <span className="text-[8px] text-textMuted font-mono">CONFIDENCE</span>
            <span className="text-xs font-bold text-white mt-0.5">
              {formatPercentage(report.scores.confidence, 0)}
            </span>
          </div>
          
          <div className={`flex flex-col border px-3 py-1 rounded-lg text-center min-w-[85px] ${riskColors[report.risk_profile.level] || 'border-borderDark text-white'}`}>
            <span className="text-[8px] text-textMuted font-mono">RISK LEVEL</span>
            <span className="text-xs font-bold mt-0.5">
              {(report.risk_profile.level || 'Unknown').toUpperCase()}
            </span>
          </div>
        </div>

        {/* Export PDF Report */}
        <button
          onClick={handleExportPdf}
          disabled={isExporting}
          title="Export PDF research report"
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-surface border border-borderDark text-textMuted hover:text-white hover:border-brand/40 text-xs font-mono font-bold transition-all shrink-0 disabled:opacity-50"
        >
          {isExporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileDown className="w-3.5 h-3.5" />}
          <span className="hidden sm:inline">Export PDF</span>
        </button>

        {/* Reusable Header Search Bar */}
        <SearchBar
          onSearch={onSearch}
          isLoading={isLoading}
          placeholder="Search stock..."
          compact={true}
          className="w-full sm:w-56 shrink-0"
        />
      </div>
    </header>
  );
};
