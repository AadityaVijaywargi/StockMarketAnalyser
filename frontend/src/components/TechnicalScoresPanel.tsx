import React from 'react';
import { TechnicalScores } from '../types';
import { Compass, TrendingUp, BarChart3, ShieldAlert, Sparkles, Activity, ShieldCheck } from 'lucide-react';
import { formatScore, formatNumber } from '../utils/formatter';

interface TechnicalScoresPanelProps {
  scores: TechnicalScores;
}

export const TechnicalScoresPanel: React.FC<TechnicalScoresPanelProps> = ({ scores }) => {
  const cards = [
    { name: 'Trend Structure', score: scores.trend, icon: TrendingUp, color: 'text-brand' },
    { name: 'Momentum', score: scores.momentum, icon: Compass, color: 'text-blue-500' },
    { name: 'Volume Flow', score: scores.volume, icon: BarChart3, color: 'text-purple-500' },
    { name: 'Candle & Chart Patterns', score: scores.pattern, icon: Sparkles, color: 'text-yellow-500' },
    { name: 'Price Volatility Stability', score: scores.volatility, icon: Activity, color: 'text-teal-500' },
    { name: 'Support strength', score: scores.support, icon: ShieldCheck, color: 'text-bullish' },
    { name: 'Resistance margin', score: scores.resistance, icon: ShieldAlert, color: 'text-bearish' },
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* Overall Score Banner */}
      <div className="glass-panel p-6 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-6 shadow-premium relative overflow-hidden">
        {/* Glow backdrop decorative */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-brand/5 rounded-full filter blur-3xl pointer-events-none" />
        
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-brand/10 border border-brand/20 flex items-center justify-center">
            <Activity className="w-6 h-6 text-brand" />
          </div>
          <div>
            <h3 className="font-bold text-lg text-white">Overall Technical Score</h3>
            <p className="text-xs text-textMuted mt-0.5">Weighted sum of all underlying technical indicators</p>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="flex flex-col text-right">
            <span className="text-xs text-textMuted font-mono">RECOMMENDATION</span>
            <span className={`text-xl font-black mt-0.5 ${
              scores.recommendation === 'BUY' ? 'text-bullish' : scores.recommendation === 'WATCH' ? 'text-yellow-500' : 'text-bearish'
            }`}>
              {scores.recommendation || 'WATCH'}
            </span>
          </div>

          <div className="w-20 h-20 rounded-full border-4 border-borderDark flex items-center justify-center relative bg-background">
            <div className="text-center">
              <span className="text-2xl font-black font-mono text-white">{formatScore(scores.overall_score)}</span>
              <p className="text-[8px] text-textMuted font-mono uppercase">SCORE</p>
            </div>
            {/* Simple circular accent border glow */}
            <div className="absolute inset-[-4px] rounded-full border border-brand/35 animate-pulse" />
          </div>
        </div>
      </div>

      {/* Grid of underlying scores */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card, index) => {
          const Icon = card.icon;
          return (
            <div key={index} className="bg-surface border border-borderDark p-5 rounded-xl hover:border-brand/20 transition-all flex flex-col justify-between group">
              <div className="flex justify-between items-start">
                <div className={`w-9 h-9 rounded-lg bg-white/[0.03] flex items-center justify-center ${card.color}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-textMuted font-mono uppercase block">WEIGHT</span>
                  <span className="text-xs font-semibold text-white font-mono">{formatNumber(card.score?.weight, 2)}</span>
                </div>
              </div>

              <div className="mt-5">
                <span className="text-xs text-textMuted font-medium block">{card.name}</span>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-2xl font-bold font-mono text-white">{formatScore(card.score?.value)}</span>
                  <span className="text-[11px] text-textMuted font-mono">/ 100</span>
                </div>
              </div>

              {/* Progress and Contribution details */}
              <div className="mt-4 border-t border-borderDark/40 pt-3 flex justify-between items-center text-[10px] font-mono text-textMuted">
                <span>CONTRIBUTION:</span>
                <span className="font-semibold text-white">{formatNumber(card.score?.contribution, 1)} pts</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
