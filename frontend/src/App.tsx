import React, { useState, useEffect, useRef, Suspense, lazy } from 'react';
import { Sidebar } from './components/Sidebar';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ProtectedRoute } from './components/ProtectedRoute';
import { useAuth } from './context/AuthContext';
import { NotificationCenterSidebar } from './components/NotificationCenterSidebar';
import { apiService } from './services/api';
import { DeterministicAnalysisReport } from './types';
import { Loader2, AlertCircle, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Routes, Route, useNavigate, useParams, useSearchParams, useLocation, Navigate } from 'react-router-dom';

// Route-level code splitting: each page (and everything it alone pulls in -
// TechnicalChart+lightweight-charts for the chart pages, jsPDF for the
// dashboard, etc.) only downloads when a user actually navigates there,
// instead of all of it landing in one ~1.3MB initial bundle regardless of
// which single page someone opens first.
const LandingPage = lazy(() => import('./pages/LandingPage').then(m => ({ default: m.LandingPage })));
const DashboardPage = lazy(() => import('./pages/DashboardPage').then(m => ({ default: m.DashboardPage })));
const WatchlistPage = lazy(() => import('./pages/WatchlistPage').then(m => ({ default: m.WatchlistPage })));
const MarketOverviewPage = lazy(() => import('./pages/MarketOverviewPage').then(m => ({ default: m.MarketOverviewPage })));
const PortfolioPage = lazy(() => import('./pages/PortfolioPage').then(m => ({ default: m.PortfolioPage })));
const BacktestingPage = lazy(() => import('./pages/BacktestingPage').then(m => ({ default: m.BacktestingPage })));
const SettingsPage = lazy(() => import('./pages/SettingsPage').then(m => ({ default: m.SettingsPage })));
const ChartPage = lazy(() => import('./pages/ChartPage').then(m => ({ default: m.ChartPage })));
const ComparePage = lazy(() => import('./pages/ComparePage').then(m => ({ default: m.ComparePage })));
const LoginPage = lazy(() => import('./pages/LoginPage').then(m => ({ default: m.LoginPage })));
const SignupPage = lazy(() => import('./pages/SignupPage').then(m => ({ default: m.SignupPage })));

// Public, logged-out pages. Split out for the same reason as the app pages,
// and with more at stake: a first-time visitor landing on "/" should not
// download the charting or analysis bundles to read a marketing page.
const MarketingPage = lazy(() => import('./pages/public/MarketingPage').then(m => ({ default: m.MarketingPage })));
const RequestAccessPage = lazy(() => import('./pages/public/RequestAccessPage').then(m => ({ default: m.RequestAccessPage })));
const PrivacyPolicyPage = lazy(() => import('./pages/public/PrivacyPolicyPage').then(m => ({ default: m.PrivacyPolicyPage })));
const TermsPage = lazy(() => import('./pages/public/TermsPage').then(m => ({ default: m.TermsPage })));
const CookiePolicyPage = lazy(() => import('./pages/public/CookiePolicyPage').then(m => ({ default: m.CookiePolicyPage })));
const NotFoundPage = lazy(() => import('./pages/public/NotFoundPage').then(m => ({ default: m.NotFoundPage })));

// Path prefixes that belong to the authenticated app shell. Keep in sync
// with the <Routes> inside the app shell below.
const APP_ROUTE_PREFIXES = [
  '/app', '/dashboard', '/watchlist', '/market', '/portfolio',
  '/backtesting', '/settings', '/chart', '/compare',
];

const LandingRedirect: React.FC = () => {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <Navigate to="/app" replace /> : <MarketingPage />;
};

const RouteLoadingFallback: React.FC = () => (
  <div className="flex-1 min-h-screen flex items-center justify-center bg-background">
    <Loader2 className="w-6 h-6 animate-spin text-brandText" />
  </div>
);

const saveToRecentSearches = (ticker: string) => {
  try {
    const cached = localStorage.getItem('recent_searches');
    let searches: string[] = cached ? JSON.parse(cached) : [];
    searches = [ticker, ...searches.filter(s => s !== ticker)];
    localStorage.setItem('recent_searches', JSON.stringify(searches.slice(0, 5)));
  } catch (e) {
    console.error("Failed to save recent search", e);
  }
};

const DashboardRouteWrapper: React.FC<{
  error: string | null;
  setError: (val: string | null) => void;
  stagesList: string[];
}> = ({
  error,
  setError,
  stagesList
}) => {
  const { ticker } = useParams<{ ticker: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const timeframe = searchParams.get('timeframe') || '1d';
  const navigate = useNavigate();

  const [report, setReport] = useState<DeterministicAnalysisReport | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [timeframeError, setTimeframeError] = useState<string | null>(null);
  const [loadingStageIndex, setLoadingStageIndex] = useState(0);
  const [loadingTicker, setLoadingTicker] = useState('');

  // Keep a reference to the active ticker to determine if it is a new load or a timeframe change
  const activeTickerRef = useRef<string>('');

  useEffect(() => {
    if (!ticker) return;
    
    const controller = new AbortController();
    let isMounted = true;

    const fetchReport = async () => {
      const targetTicker = ticker.toUpperCase();
      const cleanReportTicker = report ? report.ticker.replace(".NS", "").toUpperCase() : "";
      const isNewStock = !report || cleanReportTicker !== targetTicker.replace(".NS", "");

      if (isNewStock) {
        // Full screen pipeline loading for completely new ticker
        setReport(null);
        setIsLoading(true);
        setIsUpdating(false);
        setLoadingStageIndex(0);
        setLoadingTicker(targetTicker);
        activeTickerRef.current = targetTicker;
      } else {
        // In-dashboard overlay loading for timeframe switch on the same stock
        setIsUpdating(true);
        setIsLoading(false);
      }
      
      setTimeframeError(null);
      setError(null);

      // Setup fake logging timers for initial full-screen loaders
      const stageIntervals = [200, 200, 200, 200, 200];
      const timers: number[] = [];

      if (isNewStock) {
        const runTimer = (idx: number) => {
          if (idx >= stageIntervals.length) return;
          const t = window.setTimeout(() => {
            if (isMounted) {
              setLoadingStageIndex(idx + 1);
              runTimer(idx + 1);
            }
          }, stageIntervals[idx]);
          timers.push(t);
        };
        runTimer(0);
      }

      try {
        const data = await apiService.analyzeTicker(ticker, timeframe, controller.signal);
        
        if (isMounted) {
          if (isNewStock) {
            setLoadingStageIndex(6);
            await new Promise(resolve => setTimeout(resolve, 150));
          }
          setReport(data);
          saveToRecentSearches(data.ticker);
        }
      } catch (err: any) {
        if (isMounted) {
          // If the request was cancelled by subsequent click, ignore the error completely
          if (err.name === 'CanceledError' || err.code === 'ERR_CANCELED') {
            return;
          }

          console.error(err);
          let errMsg = `Failed to download ${timeframe.toUpperCase()} data.`;
          if (err.response && err.response.data && err.response.data.detail) {
            errMsg = err.response.data.detail;
          }

          if (isNewStock) {
            // New stock load failed completely: display error banner in dashboard without benchmark redirect
            setError(errMsg);
          } else {
            // Timeframe switch failed: display warning in-dashboard, keep old report visible
            setTimeframeError(`Unable to load ${timeframe.toUpperCase()} data.`);
          }
        }
      } finally {
        timers.forEach(t => clearTimeout(t));
        if (isMounted) {
          setIsLoading(false);
          setIsUpdating(false);
        }
      }
    };

    fetchReport();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [ticker, timeframe]);

  const handleSearch = (newTicker: string) => {
    navigate(`/dashboard/${newTicker.toUpperCase()}?timeframe=${timeframe}`);
  };

  // If loading a new ticker from scratch, render the Pipeline stages
  if (isLoading || !report) {
    return (
      <div className="flex-1 bg-background flex flex-col items-center justify-center p-6 min-h-screen">
        <div className="max-w-md w-full bg-surface border border-borderDark rounded-2xl p-6 shadow-premium flex flex-col gap-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-brand/5 rounded-full filter blur-2xl" />
          
          <div className="flex items-center justify-between border-b border-borderDark pb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-2.5 h-2.5 rounded-full bg-brand animate-pulse" />
              <span className="text-xs font-bold font-mono tracking-widest text-white uppercase">
                PIPELINE ANALYSIS: {loadingTicker}
              </span>
            </div>
            <Loader2 className="w-4 h-4 animate-spin text-brandText" />
          </div>

          <div className="flex flex-col gap-3 font-mono text-xs">
            {stagesList.map((stage, idx) => {
              const isCompleted = idx < loadingStageIndex;
              const isActive = idx === loadingStageIndex;
              
              return (
                <div 
                  key={idx}
                  className={`flex items-center gap-3 transition-colors duration-250 ${
                    isCompleted 
                      ? 'text-bullish font-semibold' 
                      : isActive 
                        ? 'text-white' 
                        : 'text-textMuted'
                  }`}
                >
                  <div className="flex items-center justify-center w-5 h-5 shrink-0">
                    {isCompleted ? (
                      <span className="text-sm font-black">✓</span>
                    ) : isActive ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-brandText" />
                    ) : (
                      <div className="w-1.5 h-1.5 rounded-full bg-borderDark" />
                    )}
                  </div>
                  <span>{stage}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <DashboardPage 
        report={report} 
        onSearch={handleSearch} 
        isLoading={isLoading} 
        isUpdating={isUpdating}
        timeframeError={timeframeError}
        setTimeframeError={setTimeframeError}
      />
    </ErrorBoundary>
  );
};

export const App: React.FC = () => {
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
  // Routes that render the authenticated app shell (sidebar + notification
  // rail). Anything not matching one of these is a logged-out page - the
  // marketing page, the legal pages, the auth screens, or a 404 - and renders
  // without the app chrome.
  const isAppRoute = APP_ROUTE_PREFIXES.some(
    prefix => location.pathname === prefix || location.pathname.startsWith(`${prefix}/`),
  );

  const stagesList = [
    "Downloading historical market data...",
    "Computing technical indicators...",
    "Detecting chart & candle patterns...",
    "Calculating support & resistance zones...",
    "Computing weighted technical scores...",
    "Finalizing market context & report schemas..."
  ];

  const handleSearch = (ticker: string) => {
    navigate(`/dashboard/${ticker.toUpperCase()}`);
  };

  const handleReset = () => {
    setError(null);
    navigate('/app');
  };

  if (!isAppRoute) {
    return (
      <Suspense fallback={<RouteLoadingFallback />}>
        <Routes>
          {/* "/" is the public marketing page. Signed-in visitors are sent
              straight through to the app home rather than being shown a
              pitch for a product they already have. */}
          <Route path="/" element={<LandingRedirect />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/request-access" element={<RequestAccessPage />} />
          <Route path="/privacy" element={<PrivacyPolicyPage />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="/cookies" element={<CookiePolicyPage />} />
          {/* Real 404. This replaced a catch-all redirect to "/", which
              turned every mistyped URL into a soft 404 served with HTTP 200. */}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
    );
  }

  return (
    <div className="flex bg-background text-white min-h-screen overflow-hidden">
      {/* 1. Navigation Sidebar */}
      <Sidebar onSearchClick={handleReset} />

      {/* 2. Main content container */}
      <div className="flex-1 flex flex-col min-h-screen overflow-x-hidden relative">
        
        {/* Error Notification Alert Banner */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="absolute top-6 left-6 right-6 z-50 p-4 rounded-xl border border-bearish/30 bg-surface/95 backdrop-blur-md shadow-premium flex items-center justify-between gap-3 text-sm text-bearish"
            >
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <span className="font-semibold">{error}</span>
              </div>
              <button 
                onClick={() => setError(null)}
                className="text-textMuted hover:text-white transition-all p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Page Routing */}
        <Suspense fallback={<RouteLoadingFallback />}>
        <Routes>
          <Route
            path="/app"
            element={
              <ProtectedRoute>
                <LandingPage
                  onSearch={handleSearch}
                  isLoading={false}
                />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard/:ticker"
            element={
              <ProtectedRoute>
                <DashboardRouteWrapper
                  error={error}
                  setError={setError}
                  stagesList={stagesList}
                />
              </ProtectedRoute>
            }
          />
          <Route
            path="/watchlist"
            element={
              <ProtectedRoute>
                <WatchlistPage
                  onSearch={handleSearch}
                  isLoading={false}
                />
              </ProtectedRoute>
            }
          />
          <Route
            path="/market"
            element={
              <ProtectedRoute>
                <MarketOverviewPage
                  onSearch={handleSearch}
                  isLoading={false}
                />
              </ProtectedRoute>
            }
          />
          <Route
            path="/portfolio"
            element={<ProtectedRoute><PortfolioPage /></ProtectedRoute>}
          />
          <Route
            path="/backtesting"
            element={<ProtectedRoute><BacktestingPage /></ProtectedRoute>}
          />
          <Route
            path="/settings"
            element={<ProtectedRoute><SettingsPage /></ProtectedRoute>}
          />
          <Route
            path="/chart/:ticker"
            element={<ProtectedRoute><ChartPage /></ProtectedRoute>}
          />
          <Route
            path="/compare"
            element={<ProtectedRoute><ComparePage /></ProtectedRoute>}
          />
        </Routes>
        </Suspense>
      </div>

      {/* 3. Persistent Right Notification Sidebar */}
      <NotificationCenterSidebar />
    </div>
  );
};

export default App;
