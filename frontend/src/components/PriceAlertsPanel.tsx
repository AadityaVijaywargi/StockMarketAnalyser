import React, { useState, useEffect } from 'react';
import { PriceAlert } from '../types';
import { priceAlertsService, PRICE_ALERTS_UPDATED_EVENT } from '../services/price_alerts_service';
import { Bell, BellPlus, TrendingUp, TrendingDown, X, ChevronDown, ChevronUp } from 'lucide-react';

interface PriceAlertsPanelProps {
  ticker: string;
  companyName: string;
  currentPrice?: number;
}

export const PriceAlertsPanel: React.FC<PriceAlertsPanelProps> = ({ ticker, companyName, currentPrice }) => {
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [isCollapsed, setIsCollapsed] = useState<boolean>(true);
  const [targetInput, setTargetInput] = useState<string>('');
  const [direction, setDirection] = useState<'above' | 'below'>('above');

  const reload = () => {
    const clean = ticker.toUpperCase().trim();
    setAlerts(priceAlertsService.getAlerts().filter(a => a.ticker.toUpperCase() === clean));
  };

  useEffect(() => {
    reload();
    const handleUpdate = () => reload();
    window.addEventListener(PRICE_ALERTS_UPDATED_EVENT, handleUpdate);
    return () => window.removeEventListener(PRICE_ALERTS_UPDATED_EVENT, handleUpdate);
  }, [ticker]);

  useEffect(() => {
    if (currentPrice && !targetInput) {
      setDirection('above');
    }
  }, [currentPrice]);

  const handleAdd = () => {
    const price = parseFloat(targetInput);
    if (!price || price <= 0) return;
    priceAlertsService.addAlert(ticker, companyName, price, direction);
    setTargetInput('');
  };

  const activeAlerts = alerts.filter(a => !a.triggered);
  const triggeredAlerts = alerts.filter(a => a.triggered).slice(0, 3);

  return (
    <div className="bg-surface border border-borderDark rounded-2xl shadow-lg overflow-hidden">
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="w-full flex items-center justify-between p-4 hover:bg-white/[0.02] transition-all"
      >
        <h3 className="font-bold text-sm text-white font-mono flex items-center gap-2">
          <Bell className="w-4 h-4 text-brand" />
          <span>Price Alerts</span>
          {activeAlerts.length > 0 && (
            <span className="text-[10px] font-mono bg-brand/15 text-brand border border-brand/30 px-2 py-0.5 rounded-full">
              {activeAlerts.length} active
            </span>
          )}
        </h3>
        {isCollapsed ? <ChevronDown className="w-4 h-4 text-textMuted" /> : <ChevronUp className="w-4 h-4 text-textMuted" />}
      </button>

      {!isCollapsed && (
        <div className="px-4 pb-4 flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <div className="flex rounded-lg overflow-hidden border border-borderDark shrink-0">
              <button
                onClick={() => setDirection('above')}
                className={`px-3 py-2 text-xs font-mono font-bold flex items-center gap-1.5 transition-all ${direction === 'above' ? 'bg-bullish/20 text-bullish' : 'bg-background text-textMuted hover:text-white'}`}
              >
                <TrendingUp className="w-3.5 h-3.5" /> Above
              </button>
              <button
                onClick={() => setDirection('below')}
                className={`px-3 py-2 text-xs font-mono font-bold flex items-center gap-1.5 transition-all ${direction === 'below' ? 'bg-bearish/20 text-bearish' : 'bg-background text-textMuted hover:text-white'}`}
              >
                <TrendingDown className="w-3.5 h-3.5" /> Below
              </button>
            </div>
            <input
              type="number"
              step="0.05"
              value={targetInput}
              onChange={e => setTargetInput(e.target.value)}
              placeholder={currentPrice ? currentPrice.toFixed(2) : 'Target price'}
              className="flex-1 min-w-0 px-3 py-2 rounded-lg bg-background border border-borderDark focus:border-brand/60 outline-none text-sm text-white font-mono transition-all"
            />
            <button
              onClick={handleAdd}
              disabled={!targetInput || parseFloat(targetInput) <= 0}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-brand text-black text-xs font-mono font-bold hover:brightness-110 disabled:opacity-40 disabled:pointer-events-none transition-all shrink-0"
            >
              <BellPlus className="w-3.5 h-3.5" />
              <span>Set</span>
            </button>
          </div>

          {activeAlerts.length === 0 && triggeredAlerts.length === 0 && (
            <p className="text-[11px] text-textMuted">No alerts set for {ticker.replace('.NS', '').replace('.BO', '')} yet.</p>
          )}

          {activeAlerts.map(alert => (
            <div key={alert.id} className="flex items-center justify-between p-2.5 rounded-lg bg-background border border-borderDark/60">
              <div className="flex items-center gap-2 text-xs font-mono">
                {alert.direction === 'above' ? <TrendingUp className="w-3.5 h-3.5 text-bullish" /> : <TrendingDown className="w-3.5 h-3.5 text-bearish" />}
                <span className="text-slate-200">Alert when {alert.direction === 'above' ? 'above' : 'below'} <span className="font-bold text-white">₹{alert.target_price.toFixed(2)}</span></span>
              </div>
              <button
                onClick={() => priceAlertsService.removeAlert(alert.id)}
                className="p-1 rounded text-textMuted hover:text-bearish transition-colors"
                title="Remove alert"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}

          {triggeredAlerts.length > 0 && (
            <div className="flex flex-col gap-1.5 pt-1 border-t border-borderDark/60">
              <span className="text-[10px] text-textMuted font-mono uppercase tracking-wider">Recently triggered</span>
              {triggeredAlerts.map(alert => (
                <div key={alert.id} className="flex items-center justify-between text-[11px] font-mono text-textMuted">
                  <span>{alert.direction === 'above' ? 'Crossed above' : 'Crossed below'} ₹{alert.target_price.toFixed(2)}</span>
                  <button
                    onClick={() => priceAlertsService.removeAlert(alert.id)}
                    className="p-1 rounded hover:text-bearish transition-colors"
                    title="Dismiss"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
