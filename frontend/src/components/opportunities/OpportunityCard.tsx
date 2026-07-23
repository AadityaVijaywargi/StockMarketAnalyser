import React from 'react';
import { TopOpportunityCard } from '../../types';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, ShieldAlert, Sparkles, ArrowUpRight } from 'lucide-react';

interface OpportunityCardProps {
  card: TopOpportunityCard;
  onClick: (ticker: string) => void;
}

export const OpportunityCard: React.FC<OpportunityCardProps> = ({ card, onClick }) => {
  const isPositive = card.price_change_pct >= 0;
  
  // Recommendation colors
  const recStyles = {
    BUY: 'bg-bullish/15 text-bullish border-bullish/40 shadow-[0_0_15px_rgba(34,197,94,0.15)]',
    WATCH: 'bg-warning/15 text-warning border-warning/40 shadow-[0_0_15px_rgba(234,179,8,0.15)]',
    AVOID: 'bg-bearish/15 text-bearish border-bearish/40 shadow-[0_0_15px_rgba(239,68,68,0.15)]',
  }[card.recommendation] || 'bg-surface text-textMuted border-borderDark';

  // Overall Score progress bar color
  const scoreColor = card.overall_score >= 70 
    ? 'bg-bullish' 
    : card.overall_score >= 50 
    ? 'bg-warning' 
    : 'bg-bearish';

  return (
    <motion.div
      whileHover={{ y: -5, transition: { duration: 0.2 } }}
      onClick={() => onClick(card.ticker)}
      className="bg-surface/90 border border-borderDark/80 hover:border-brand/40 rounded-2xl p-5 cursor-pointer shadow-premium hover:shadow-2xl transition-all flex flex-col justify-between gap-4 relative overflow-hidden group font-sans"
    >
      {/* Top Ambient Glow */}
      <div className="absolute -top-12 -right-12 w-28 h-28 bg-brand/5 rounded-full blur-2xl group-hover:bg-brand/15 transition-all" />

      {/* Header Row: Company Details & Recommendation Badge */}
      <div className="flex items-start justify-between gap-3 z-10">
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-2">
            <span className="text-base font-bold text-white font-mono tracking-wide group-hover:text-brand transition-colors">
              {card.ticker.replace('.NS', '')}
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/[0.04] text-textMuted border border-borderDark/40">
              {card.sector}
            </span>
          </div>
          <h3 className="text-xs text-textMuted line-clamp-1 font-medium">
            {card.company_name}
          </h3>
        </div>

        {/* Large Recommendation Badge */}
        <div className={`px-3 py-1 rounded-xl text-xs font-mono font-bold uppercase tracking-wider border flex items-center gap-1.5 shrink-0 ${recStyles}`}>
          {card.recommendation === 'BUY' && <Sparkles className="w-3.5 h-3.5" />}
          {card.recommendation === 'AVOID' && <ShieldAlert className="w-3.5 h-3.5" />}
          <span>{card.recommendation}</span>
        </div>
      </div>

      {/* Price & Change Metric Block */}
      <div className="flex items-baseline justify-between border-y border-borderDark/30 py-3 my-1">
        <div>
          <span className="text-[10px] uppercase font-mono tracking-wider text-textMuted block">Current Price</span>
          <span className="text-lg font-mono font-bold text-white">
            ₹{card.current_price.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </span>
        </div>
        
        <div className={`flex items-center gap-1 font-mono text-xs font-semibold px-2.5 py-1 rounded-lg ${
          isPositive ? 'bg-bullish/10 text-bullish' : 'bg-bearish/10 text-bearish'
        }`}>
          {isPositive ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
          <span>{isPositive ? '+' : ''}{card.price_change_pct.toFixed(2)}%</span>
        </div>
      </div>

      {/* Scores & Progress Gauge Block */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between text-xs font-mono">
          <span className="text-textMuted">Overall Technical Score</span>
          <span className="font-bold text-white">{card.overall_score.toFixed(1)} <span className="text-textMuted text-[10px]">/ 100</span></span>
        </div>
        
        {/* Progress Bar Gauge */}
        <div className="w-full bg-borderDark/40 h-2 rounded-full overflow-hidden">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: `${card.overall_score}%` }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            className={`h-full rounded-full ${scoreColor}`}
          />
        </div>

        <div className="flex items-center justify-between text-[11px] font-mono text-textMuted mt-1">
          <span>Confidence: <strong className="text-white">{card.confidence.toFixed(0)}%</strong></span>
          <span>Trend: <strong className={card.trend_direction === 'BULLISH' ? 'text-bullish' : 'text-bearish'}>{card.trend_direction}</strong></span>
        </div>
      </div>

      {/* Key Highlights Bullet Points */}
      {card.key_highlights.length > 0 && (
        <div className="flex flex-col gap-1.5 pt-2 border-t border-borderDark/30">
          <span className="text-[10px] uppercase font-mono tracking-wider text-textMuted">Key Signals</span>
          <div className="flex flex-wrap gap-1.5">
            {card.key_highlights.map((highlight, idx) => (
              <span 
                key={idx}
                className="text-[10px] font-sans px-2 py-0.5 rounded-md bg-white/[0.02] text-textMuted border border-borderDark/40 flex items-center gap-1 group-hover:border-borderDark transition-all"
              >
                <span className="w-1 h-1 rounded-full bg-brand shrink-0" />
                <span className="truncate max-w-[180px]">{highlight}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Action Footer Button */}
      <div className="pt-2 flex items-center justify-end text-xs font-mono text-brand font-semibold group-hover:translate-x-1 transition-transform">
        <span>View Quantitative Analysis</span>
        <ArrowUpRight className="w-4 h-4 ml-1" />
      </div>
    </motion.div>
  );
};
