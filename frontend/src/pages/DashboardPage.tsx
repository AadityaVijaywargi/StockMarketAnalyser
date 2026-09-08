import React, { useState, useEffect } from 'react';
import { DeterministicAnalysisReport, LiveQuote, PredictionHorizon, PredictionResult } from '../types';
import { DashboardHeader } from '../components/DashboardHeader';
import { TopNavbar } from '../components/TopNavbar';
import { TechnicalScoresPanel } from '../components/TechnicalScoresPanel';
import { MarketContextPanel } from '../components/MarketContextPanel';
import { PatternsPanel } from '../components/PatternsPanel';
import { SupportResistancePanel } from '../components/SupportResistancePanel';
import { TechnicalChart } from '../components/TechnicalChart';
import { AIResearchPanel } from '../components/AIResearchPanel';
import { TradeSignalPanel } from '../components/TradeSignalPanel';
import { ActiveTradePanel } from '../components/ActiveTradePanel';
import { TradePerformanceDashboard } from '../components/TradePerformanceDashboard';
import { PredictionPanel } from '../components/PredictionPanel';
import { apiService } from '../services/api';
import { useNotifications } from '../context/NotificationContext';
import { motion, AnimatePresence } from 'framer-motion';
import { useSearchParams } from 'react-router-dom';

interface DashboardPageProps {
  report: DeterministicAnalysisReport;
  onSearch: (ticker: string) => void;
  isLoading: boolean;
  isUpdating?: boolean;
  timeframeError?: string | null;
  setTimeframeError?: (val: string | null) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ 
  report, 
  onSearch, 
  isLoading,
  isUpdating = false,
  timeframeError = null,
  setTimeframeError
}) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTimeframe = searchParams.get('timeframe') || '1d';
  const { checkAndNotify } = useNotifications();

  const [localReport, setLocalReport] = useState<DeterministicAnalysisReport | null>(report);
  const [latestQuote, setLatestQuote] = useState<LiveQuote | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [aiReport, setAiReport] = useState<DeterministicAnalysisReport | null>(null);
  const [predictionHorizon, setPredictionHorizon] = useState<PredictionHorizon>('1d');
  const [prediction, setPrediction] = useState<PredictionResult | null>(null);

  useEffect(() => {
    let isMounted = true;
    apiService.getPrediction(report.ticker, predictionHorizon).then(data => {
      if (isMounted) setPrediction(data);
    }).catch(error => console.error('Failed to fetch prediction', error));
    return () => { isMounted = false; };
  }, [report.ticker, predictionHorizon]);

  // 1. Reset local state when report prop changes (new ticker searched or timeframe reloaded)
  useEffect(() => {
    setLocalReport(report);
    setAiReport(report);
    setLatestQuote(null);
    setLastUpdated(new Date().toLocaleTimeString());
    
    // Check if watched stock recommendation changed
    if (report) {
      checkAndNotify(report);
    }
  }, [report]);

  // 2. Update AI report state with stability checks
  useEffect(() => {
    if (!localReport) return;
    if (!aiReport) {
      setAiReport(localReport);
      return;
    }

    // Stability thresholds check
    const recommendationChanged = aiReport.scores.recommendation !== localReport.scores.recommendation;
    const scoreMovedSignificantly = Math.abs(aiReport.scores.overall_score - localReport.scores.overall_score) > 5.0;
    const confidenceMovedSignificantly = Math.abs((aiReport.scores?.confidence ?? 50.0) - (localReport.scores?.confidence ?? 50.0)) > 5.0;
    const patternCountChanged = aiReport.patterns.length !== localReport.patterns.length;
    const regimeChanged = aiReport.market_context.vix.regime !== localReport.market_context.vix.regime;

    if (
      recommendationChanged ||
      scoreMovedSignificantly ||
      confidenceMovedSignificantly ||
      patternCountChanged ||
      regimeChanged
    ) {
      setAiReport(localReport);
    }
  }, [localReport]);

  // 3. Live Quote Polling
  useEffect(() => {
    let isMounted = true;
    let pollIntervalId: any = null;
    let isRefreshingRecommendation = false;

    const pollQuote = async () => {
      if (document.hidden) return;

      try {
        const quote = await apiService.getLiveQuote(report.ticker);
        if (isMounted) {
          setLatestQuote(quote);
          setLastUpdated(new Date().toLocaleTimeString());

          // Update latest candlestick on the local report copy
          setLocalReport(prev => {
            if (!prev) return prev;
            const updatedClose = [...prev.chart_data.close];
            const updatedHigh = [...prev.chart_data.high];
            const updatedLow = [...prev.chart_data.low];
            const updatedVolume = [...prev.chart_data.volume];

            if (updatedClose.length > 0) {
              updatedClose[updatedClose.length - 1] = quote.price;
              updatedHigh[updatedHigh.length - 1] = Math.max(updatedHigh[updatedHigh.length - 1], quote.price);
              updatedLow[updatedLow.length - 1] = Math.min(updatedLow[updatedLow.length - 1], quote.price);
              updatedVolume[updatedVolume.length - 1] = Math.max(updatedVolume[updatedVolume.length - 1], quote.volume);
            }

            return {
              ...prev,
              chart_data: {
                ...prev.chart_data,
                close: updatedClose,
                high: updatedHigh,
                low: updatedLow,
                volume: updatedVolume
              }
            };
          });

          if (quote.is_market_open && !isRefreshingRecommendation) {
            isRefreshingRecommendation = true;
            try {
              const refreshedRecommendation = await apiService.refreshRecommendation(report.ticker);
              if (isMounted) {
                setLocalReport(prev => prev ? { ...prev, ...refreshedRecommendation } : prev);
                checkAndNotify({ ...report, ...refreshedRecommendation });
              }
            } finally {
              isRefreshingRecommendation = false;
            }
          }
        }
      } catch (e) {
        console.error("Quote polling loop failed", e);
      }
    };

    pollQuote();

    const intervalTime = latestQuote?.is_market_open ? 10000 : 60000;
    pollIntervalId = setInterval(pollQuote, intervalTime);

    const handleVisibilityChange = () => {
      clearInterval(pollIntervalId);
      if (!document.hidden) {
        pollQuote();
        pollIntervalId = setInterval(pollQuote, latestQuote?.is_market_open ? 10000 : 60000);
      } else {
        pollIntervalId = setInterval(pollQuote, 60000);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      isMounted = false;
      clearInterval(pollIntervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [report.ticker, latestQuote?.is_market_open]);

  const handleTimeframeChange = (newTimeframe: string) => {
    // Clear any previous error banner when triggering a new switch
    if (setTimeframeError) setTimeframeError(null);
    setSearchParams({ timeframe: newTimeframe });
  };

  const activeReport = localReport || report;

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-background">
      <TopNavbar onSearch={onSearch} isLoading={isLoading} />

      <DashboardHeader 
        report={activeReport} 
        onSearch={onSearch} 
        isLoading={isLoading || isUpdating}
        latestQuote={latestQuote}
        lastUpdated={lastUpdated}
        activeTimeframe={activeTimeframe}
        onTimeframeChange={handleTimeframeChange}
      />

      {/* Frame updating loading progress bar (Framer Motion) */}
      <AnimatePresence>
        {isUpdating && (
          <div className="w-full h-[3px] bg-brand/5 overflow-hidden relative">
            <motion.div 
              className="h-full bg-brand"
              initial={{ left: "-35%", width: "35%" }}
              animate={{ left: "100%" }}
              exit={{ opacity: 0 }}
              transition={{ 
                repeat: Infinity, 
                duration: 1.1, 
                ease: "easeInOut" 
              }}
              style={{ position: 'absolute' }}
            />
          </div>
        )}
      </AnimatePresence>

      {/* Timeframe Error dismissible banner */}
      <AnimatePresence>
        {timeframeError && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mx-6 mt-6 p-4 bg-bearish/10 border border-bearish/20 rounded-xl flex items-center justify-between text-bearish text-xs font-mono"
          >
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-bearish animate-ping" />
              <span>ERROR: {timeframeError} (Displaying last successful analysis)</span>
            </div>
            <button 
              onClick={() => setTimeframeError && setTimeframeError(null)}
              className="text-textMuted hover:text-white transition-all font-sans text-sm font-bold px-2"
            >
              ✕
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.main 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4 }}
        className={`p-6 flex flex-col gap-6 max-w-[1400px] w-full mx-auto transition-all duration-300 ${
          isUpdating ? 'opacity-80 pointer-events-none' : ''
        }`}
      >
        <div className="w-full">
          <AIResearchPanel report={aiReport || activeReport} />
        </div>

        <PredictionPanel prediction={prediction} horizon={predictionHorizon} onHorizonChange={setPredictionHorizon} />

        <div className="w-full">
          <TradeSignalPanel 
            initialSignal={activeReport.trade_signal} 
            prediction={prediction || activeReport.prediction}
            ticker={activeReport.ticker} 
            activeTimeframe={activeTimeframe}
            onTimeframeChange={handleTimeframeChange}
            companyName={activeReport.company_name}
          />
        </div>

        <div className="w-full">
          <ActiveTradePanel 
            ticker={activeReport.ticker} 
            latestPrice={latestQuote?.price || (activeReport.chart_data.close[activeReport.chart_data.close.length - 1])} 
          />
        </div>

        <div className="w-full">
          <TradePerformanceDashboard />
        </div>

        <div className="w-full">
          <TechnicalChart 
            chartData={activeReport.chart_data} 
            ticker={activeReport.ticker} 
            activeTimeframe={activeTimeframe}
            onTimeframeChange={handleTimeframeChange}
          />
        </div>

        <div className="w-full">
          <TechnicalScoresPanel scores={activeReport.scores} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <SupportResistancePanel 
            supportZones={activeReport.support_zones} 
            resistanceZones={activeReport.resistance_zones} 
            currentPrice={activeReport.chart_data.close[activeReport.chart_data.close.length - 1]} 
          />
          <PatternsPanel patterns={activeReport.patterns} />
        </div>

        <div className="w-full">
          <MarketContextPanel context={activeReport.market_context} />
        </div>
      </motion.main>
    </div>
  );
};
export default DashboardPage;
