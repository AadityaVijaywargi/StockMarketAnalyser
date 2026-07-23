import React from 'react';
import { MarketContext } from '../types';
import { Compass, ShieldAlert, Zap, Globe2, BarChart2 } from 'lucide-react';
import { formatNumber, formatScore } from '../utils/formatter';

interface MarketContextPanelProps {
  context: MarketContext;
}

export const MarketContextPanel: React.FC<MarketContextPanelProps> = ({ context }) => {
  const dirColors = {
    BULLISH: 'text-bullish bg-bullish/5 border-bullish/10',
    BEARISH: 'text-bearish bg-bearish/5 border-bearish/10',
    SIDEWAYS: 'text-yellow-500 bg-yellow-500/5 border-yellow-500/10',
  };

  const regimeColors = {
    Low: 'text-bullish bg-bullish/5 border-bullish/10',
    Normal: 'text-green-400 bg-green-400/5 border-green-400/10',
    Elevated: 'text-yellow-500 bg-yellow-500/5 border-yellow-500/10',
    Extreme: 'text-bearish bg-bearish/5 border-bearish/10',
  };

  const niftyDirection = context.nifty?.direction || 'SIDEWAYS';
  const bankNiftyDirection = context.bank_nifty?.direction || 'SIDEWAYS';
  const sectorDirection = context.sector?.direction || 'SIDEWAYS';
  const vixRegime = context.vix?.regime || 'Normal';

  return (
    <div className="bg-surface border border-borderDark p-6 rounded-xl flex flex-col gap-6">
      <div className="flex items-center gap-3 border-b border-borderDark pb-4">
        <div className="w-8 h-8 rounded bg-brand/10 border border-brand/20 flex items-center justify-center">
          <Globe2 className="w-4 h-4 text-brand" />
        </div>
        <h3 className="font-bold text-base text-white">Market Context Engine</h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* NIFTY 50 Benchmark card */}
        <div className="flex flex-col justify-between p-4 bg-background border border-borderDark rounded-lg">
          <div>
            <span className="text-[10px] text-textMuted font-mono">BENCHMARK INDEX</span>
            <h4 className="font-bold text-sm text-white mt-1">NIFTY 50 (^NSEI)</h4>
          </div>
          <div className="mt-4 flex flex-col gap-2">
            <div className="flex justify-between items-center text-xs">
              <span className="text-textMuted">Trend:</span>
              <span className={`px-2 py-0.5 rounded font-semibold text-[10px] border ${dirColors[niftyDirection]}`}>
                {niftyDirection}
              </span>
            </div>
            <div className="flex justify-between items-center text-xs font-mono">
              <span className="text-textMuted">Strength:</span>
              <span className="text-white font-bold">{formatNumber(context.nifty?.strength, 1)}/100</span>
            </div>
            <div className="flex justify-between items-center text-xs font-mono">
              <span className="text-textMuted">RSI Momentum:</span>
              <span className="text-white font-bold">{formatNumber(context.nifty?.momentum, 1)}</span>
            </div>
          </div>
        </div>

        {/* BANK NIFTY Benchmark card */}
        <div className="flex flex-col justify-between p-4 bg-background border border-borderDark rounded-lg">
          <div>
            <span className="text-[10px] text-textMuted font-mono">BANK BENCHMARK</span>
            <h4 className="font-bold text-sm text-white mt-1">BANK NIFTY</h4>
          </div>
          <div className="mt-4 flex flex-col gap-2">
            <div className="flex justify-between items-center text-xs">
              <span className="text-textMuted">Trend:</span>
              <span className={`px-2 py-0.5 rounded font-semibold text-[10px] border ${dirColors[bankNiftyDirection]}`}>
                {bankNiftyDirection}
              </span>
            </div>
            <div className="flex justify-between items-center text-xs font-mono">
              <span className="text-textMuted">Strength:</span>
              <span className="text-white font-bold">{formatNumber(context.bank_nifty?.strength, 1)}/100</span>
            </div>
            <div className="flex justify-between items-center text-xs font-mono">
              <span className="text-textMuted">RSI Momentum:</span>
              <span className="text-white font-bold">{formatNumber(context.bank_nifty?.momentum, 1)}</span>
            </div>
          </div>
        </div>

        {/* India VIX Volatility Card */}
        <div className="flex flex-col justify-between p-4 bg-background border border-borderDark rounded-lg">
          <div>
            <span className="text-[10px] text-textMuted font-mono">MARKET VOLATILITY</span>
            <h4 className="font-bold text-sm text-white mt-1">INDIA VIX</h4>
          </div>
          <div className="mt-4 flex flex-col gap-2">
            <div className="flex justify-between items-center text-xs">
              <span className="text-textMuted">VIX Level:</span>
              <span className="text-white font-mono font-bold">{formatNumber(context.vix?.vix_value, 2)}</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-textMuted">Regime:</span>
              <span className={`px-2 py-0.5 rounded font-semibold text-[10px] border ${regimeColors[vixRegime]}`}>
                {vixRegime.toUpperCase()}
              </span>
            </div>
            <div className="flex justify-between items-center text-xs font-mono">
              <span className="text-textMuted">VIX Percentile:</span>
              <span className="text-white font-bold">{formatNumber(context.vix?.percentile, 1)}%</span>
            </div>
          </div>
        </div>

        {/* Sector Index Card */}
        <div className="flex flex-col justify-between p-4 bg-background border border-borderDark rounded-lg">
          <div>
            <span className="text-[10px] text-textMuted font-mono">SECTOR PERFORMANCE</span>
            <h4 className="font-bold text-sm text-white mt-1 truncate">{context.sector?.sector_name || '--'}</h4>
          </div>
          <div className="mt-4 flex flex-col gap-2">
            <div className="flex justify-between items-center text-xs">
              <span className="text-textMuted">Sector Trend:</span>
              <span className={`px-2 py-0.5 rounded font-semibold text-[10px] border ${dirColors[sectorDirection]}`}>
                {sectorDirection}
              </span>
            </div>
            <div className="flex justify-between items-center text-xs font-mono">
              <span className="text-textMuted">RS vs Nifty:</span>
              <span className="text-white font-bold">{formatNumber(context.sector?.relative_strength_vs_nifty, 2)}x</span>
            </div>
            <div className="flex justify-between items-center text-xs font-mono">
              <span className="text-textMuted">Sector Momentum:</span>
              <span className="text-white font-bold">{formatNumber(context.sector?.sector_momentum, 1)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Stock relationship metrics */}
      <div className="mt-4 pt-4 border-t border-borderDark/40 grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-background border border-borderDark/60 p-3 rounded-lg flex items-center gap-3">
          <div className="text-brand">
            <BarChart2 className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[9px] text-textMuted font-mono block">STOCK BETA</span>
            <span className="text-sm font-bold font-mono text-white">{formatNumber(context.stock_beta, 2)}</span>
          </div>
        </div>

        <div className="bg-background border border-borderDark/60 p-3 rounded-lg flex items-center gap-3">
          <div className="text-blue-500">
            <Compass className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[9px] text-textMuted font-mono block">NIFTY CORRELATION</span>
            <span className="text-sm font-bold font-mono text-white">{formatNumber(context.stock_correlation, 2)}</span>
          </div>
        </div>

        <div className="bg-background border border-borderDark/60 p-3 rounded-lg flex items-center gap-3">
          <div className="text-yellow-500">
            <Zap className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[9px] text-textMuted font-mono block">RS RATING (0-100)</span>
            <span className="text-sm font-bold font-mono text-white">{formatScore(context.relative_strength_rating)}</span>
          </div>
        </div>

        <div className="bg-background border border-borderDark/60 p-3 rounded-lg flex items-center gap-3">
          <div className="text-purple-500">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[9px] text-textMuted font-mono block">RS VS BENCHMARK</span>
            <span className={`text-sm font-bold font-mono ${
              (context.relative_strength_rating ?? 0) > 50 ? 'text-bullish' : 'text-bearish'
            }`}>
              {(context.relative_strength_rating ?? 0) > 50 ? 'OUTPERFORM' : 'UNDERPERFORM'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
