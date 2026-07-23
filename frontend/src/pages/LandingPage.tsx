import React, { useState, useEffect } from 'react';
import { Sparkles, History, ArrowUpRight, ArrowDownRight, Globe } from 'lucide-react';
import { motion } from 'framer-motion';
import { SearchBar } from '../components/search/SearchBar';
import { TopOpportunitiesSection } from '../components/opportunities/TopOpportunitiesSection';

interface LandingPageProps {
  onSearch: (ticker: string) => void;
  isLoading: boolean;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onSearch, isLoading }) => {
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [currentTime, setCurrentTime] = useState('');

  useEffect(() => {
    try {
      const cached = localStorage.getItem('recent_searches');
      if (cached) {
        setRecentSearches(JSON.parse(cached));
      }
    } catch (e) {
      console.error("Failed to parse recent searches", e);
    }
    
    // Update local clock for premium market stats
    const updateTime = () => {
      const options: Intl.DateTimeFormatOptions = { 
        timeZone: 'Asia/Kolkata', 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit',
        hour12: false
      };
      setCurrentTime(new Intl.DateTimeFormat('en-US', options).format(new Date()));
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  const handlePopularClick = (ticker: string) => {
    onSearch(ticker);
  };

  const popularStocks = ['RELIANCE.NS', 'TCS.NS', 'INFY.NS', 'HDFCBANK.NS', 'SBIN.NS'];

  // Mock real-time market overview stats for the header tape
  const marketStats = [
    { name: 'NIFTY 50', value: '24,142.05', change: '+102.30', pct: '+0.42%', positive: true },
    { name: 'BANK NIFTY', value: '51,200.40', change: '-61.45', pct: '-0.12%', positive: false },
    { name: 'INDIA VIX', value: '15.22', change: '+0.15', pct: 'Low Regime', positive: true },
  ];

  return (
    <div className="flex-1 flex flex-col justify-between min-h-screen bg-background relative overflow-y-auto font-sans select-none">
      
      {/* 1. Header Grid Backdrop Decorators */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#141414_1px,transparent_1px),linear-gradient(to_bottom,#141414_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-70 pointer-events-none" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[300px] bg-brand/5 rounded-full filter blur-[120px] pointer-events-none" />

      {/* Spacer to align center content */}
      <div className="h-10" />

      {/* 2. Main Hero Section */}
      <motion.div 
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="max-w-[870px] w-full text-center px-6 flex flex-col gap-6 mx-auto z-10"
      >
        {/* Sparkles Brand Tagline */}
        <div className="flex justify-center">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            className="flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.02] border border-borderDark text-[11px] font-semibold tracking-wider text-brand font-mono uppercase"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Institution-Grade Quant Model</span>
          </motion.div>
        </div>

        {/* Headline & Subtitle */}
        <div className="flex flex-col gap-3">
          <h1 className="text-4xl md:text-6xl font-black tracking-tight text-white leading-none">
            AI Equity Research <br/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-white to-white/40">Platform</span>
          </h1>
          <p className="text-xs md:text-sm text-textMuted max-w-md mx-auto leading-relaxed mt-2 font-medium">
            Professional stock analysis powered by deterministic quantitative indicators, swing pivots, and AI explanation layers.
          </p>
        </div>

        {/* Reusable Search Bar Wrapper */}
        <div className="flex justify-center mt-4">
          <SearchBar onSearch={onSearch} isLoading={isLoading} />
        </div>

        {/* Popular Tickers tape */}
        <div className="flex flex-col gap-2 mt-2">
          <span className="text-[9px] text-textMuted font-mono uppercase tracking-wider block">POPULAR BENCHMARKS</span>
          <div className="flex flex-wrap justify-center gap-2">
            {popularStocks.map((ticker) => (
              <button
                key={ticker}
                onClick={() => handlePopularClick(ticker)}
                className="bg-surface hover:bg-surfaceLight border border-borderDark hover:border-brand/35 px-3 py-1.5 rounded-lg text-xs font-semibold font-mono text-white transition-all shadow-sm"
              >
                {ticker.split('.')[0]}
              </button>
            ))}
          </div>
        </div>

        {/* History searches */}
        {recentSearches.length > 0 && (
          <div className="flex justify-center items-center gap-2 mt-1">
            <History className="w-3.5 h-3.5 text-textMuted" />
            <span className="text-[10px] text-textMuted font-mono uppercase mr-1">RECENTS:</span>
            <div className="flex gap-2">
              {recentSearches.slice(0, 3).map((ticker) => (
                <button
                  key={ticker}
                  onClick={() => handlePopularClick(ticker)}
                  className="text-xs text-textMuted hover:text-white font-mono hover:underline transition-all"
                >
                  {ticker.split('.')[0]}
                </button>
              ))}
            </div>
          </div>
        )}
      </motion.div>

      {/* 3. Top Stock Opportunities Feed */}
      <div className="z-10 relative mt-12">
        <TopOpportunitiesSection onSelectStock={onSearch} />
      </div>

      {/* 3. Market overview tape at the bottom */}
      <motion.div 
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="w-full bg-surface border-t border-borderDark py-4 px-6 z-10 relative"
      >
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4 text-xs">
          {/* Market Status block */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-bullish opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-bullish"></span>
              </span>
              <span className="font-bold text-white uppercase tracking-wider">NSE ACTIVE</span>
            </div>
            <div className="h-4 w-px bg-borderDark" />
            <span className="text-textMuted font-mono">IST TIME: {currentTime}</span>
          </div>

          {/* Mini indexes widgets */}
          <div className="flex flex-wrap items-center gap-6">
            {marketStats.map((stat, idx) => (
              <div key={idx} className="flex items-center gap-2 font-mono">
                <span className="text-textMuted">{stat.name}:</span>
                <span className="text-white font-bold">{stat.value}</span>
                <div className={`flex items-center text-[10px] font-bold ${stat.positive ? 'text-bullish' : 'text-bearish'}`}>
                  {stat.positive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                  <span>{stat.change}</span>
                  <span className="ml-1">({stat.pct})</span>
                </div>
              </div>
            ))}
          </div>

          {/* Secure Engine indicator */}
          <div className="hidden lg:flex items-center gap-1.5 text-textMuted font-mono text-[10px] uppercase">
            <Globe className="w-3.5 h-3.5 text-brand" />
            <span>Deterministic Node Active</span>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
