import React from 'react';
import { ArrowUpRight, ArrowDownRight, Clock } from 'lucide-react';
import { DeterministicAnalysisReport, LiveQuote } from '../types';
import { formatPrice, formatNumber, formatPercentage } from '../utils/formatter';
import { SearchBar } from './search/SearchBar';

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
  activeTimeframe = '1d',
  onTimeframeChange
}) => {
  // Base pricing info from historical report
  const closes = report.chart_data.close;
  const basePrice = closes[closes.length - 1] || 0.0;
  const prevPrice = closes[closes.length - 2] || basePrice;
  const baseChange = basePrice - prevPrice;
  const baseChangePct = prevPrice > 0 ? (baseChange / prevPrice) * 100 : 0.0;

  // Resolve live quote values vs base historical values
  const price = latestQuote ? latestQuote.price : basePrice;
  const change = latestQuote ? latestQuote.change : baseChange;
  const changePct = latestQuote ? latestQuote.change_pct : baseChangePct;
  const high = latestQuote?.high || report.chart_data.high[report.chart_data.high.length - 1] || price;
  const low = latestQuote?.low || report.chart_data.low[report.chart_data.low.length - 1] || price;
  const volume = latestQuote?.volume || report.chart_data.volume[report.chart_data.volume.length - 1] || 0;
  const isMarketOpen = latestQuote ? latestQuote.is_market_open : false;

  const isPositive = change >= 0;

  // Recommendation styles
  const recColors = {
    BUY: 'bg-bullish/10 text-bullish border-bullish/25',
    WATCH: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/25',
    AVOID: 'bg-bearish/10 text-bearish border-bearish/25',
    SELL: 'bg-bearish/10 text-bearish border-bearish/25',
    HOLD: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/25',
  };

  // Risk profile styles
  const riskColors = {
    Low: 'text-bullish bg-bullish/5 border-bullish/10',
    Moderate: 'text-yellow-500 bg-yellow-500/5 border-yellow-500/10',
    High: 'text-orange-500 bg-orange-500/5 border-orange-500/10',
    'Very High': 'text-bearish bg-bearish/5 border-bearish/10',
  };

  const timeframes = [
    { label: '1m', value: '1m' },
    { label: '5m', value: '5m' },
    { label: '15m', value: '15m' },
    { label: '1h', value: '1h' },
    { label: '1D', value: '1d' }
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
          <h2 className="text-2xl font-bold tracking-tight text-white">{report.company_name}</h2>
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${recColors[report.scores.recommendation] || recColors.WATCH}`}>
            {report.scores.recommendation}
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
            {formatPrice(price)}
          </span>
          
          <div className={`flex items-center text-sm font-semibold font-mono ${isPositive ? 'text-bullish' : 'text-bearish'}`}>
            {isPositive ? <ArrowUpRight className="w-4 h-4 mr-0.5" /> : <ArrowDownRight className="w-4 h-4 mr-0.5" />}
            <span>{isPositive ? '+' : ''}{formatNumber(change, 2)}</span>
            <span className="ml-1.5">({isPositive ? '+' : ''}{formatPercentage(changePct, 2)})</span>
          </div>

          {/* High, Low, Volume Stats row */}
          <div className="flex items-center gap-3 text-xs text-textMuted font-mono border-l border-borderDark pl-4 ml-1">
            <span>H: <span className="text-white font-semibold">{formatPrice(high)}</span></span>
            <span>L: <span className="text-white font-semibold">{formatPrice(low)}</span></span>
            <span>VOL: <span className="text-white font-semibold">{formatVol(volume)}</span></span>
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
                  ? 'bg-[#222222] text-white shadow-sm'
                  : 'text-textMuted hover:text-white'
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
