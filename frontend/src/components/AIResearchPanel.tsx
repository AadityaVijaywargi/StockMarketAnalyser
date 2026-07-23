import React from 'react';
import { Sparkles, BrainCircuit, ArrowUpRight, ArrowDownRight, BarChart3, ShieldCheck, Zap, Info } from 'lucide-react';
import { DeterministicAnalysisReport } from '../types';
import { formatPercentage, formatNumber, formatScore, formatPrice } from '../utils/formatter';

interface AIResearchPanelProps {
  report: DeterministicAnalysisReport;
}

export const AIResearchPanel: React.FC<AIResearchPanelProps> = ({ report }) => {
  // Extract details defensively
  const name = report.company_name || 'Stock';
  const ticker = report.ticker || 'STOCK';
  const recommendation = report.scores?.recommendation ?? 'WATCH';
  const score = report.scores?.overall_score ?? 50.0;
  const confidence = report.scores?.confidence ?? 50.0;
  
  const closes = report.chart_data?.close || [];
  const currentPrice = closes[closes.length - 1] || 0.0;

  // Support / Resistance touches count helper for fallback
  const supportTouches = report.support_zones?.[0]?.touches ?? 3;
  const resistanceTouches = report.resistance_zones?.[0]?.touches ?? 4;
  const supportMidpoint = report.support_zones?.[0] 
    ? (report.support_zones[0].upper_bound + report.support_zones[0].lower_bound) / 2.0 
    : currentPrice * 0.95;
  const resistanceMidpoint = report.resistance_zones?.[0]
    ? (report.resistance_zones[0].upper_bound + report.resistance_zones[0].lower_bound) / 2.0
    : currentPrice * 1.05;

  // Sector and VIX variables
  const sectorName = report.market_context?.sector?.sector_name || 'Sector';
  const niftyTrend = report.market_context?.nifty?.direction || 'SIDEWAYS';
  const niftyStrength = report.market_context?.nifty?.strength ?? 50.0;
  const niftyMomentum = report.market_context?.nifty?.momentum ?? 50.0;
  const vixValue = report.market_context?.vix?.vix_value ?? 15.0;
  const atrPct = report.risk_profile?.atr_percentage ?? 2.5;
  const annualizedVolatility = report.risk_profile?.annualized_volatility ?? 25.0;
  const stockBeta = report.market_context?.stock_beta ?? 1.0;
  const stockCorrelation = report.market_context?.stock_correlation ?? 0.8;
  const rsRating = report.market_context?.relative_strength_rating ?? 50.0;
  const sectorTrend = report.market_context?.sector?.direction || 'SIDEWAYS';
  const sectorStrength = report.market_context?.sector?.strength ?? 50.0;
  const sectorRSNifty = report.market_context?.sector?.relative_strength_vs_nifty ?? 1.0;
  const riskLevel = report.risk_profile?.level || 'Moderate';

  // Fallback programmatic generation if backend AI report is missing
  const generateThesisParagraphs = (): string[] => {
    const p1 = `Our quantitative engine calculates a Trend Structure Score of ${formatScore(report.scores?.trend?.value)}/100 for ${name}. Price action is currently interacting with support bands near ${formatPrice(supportMidpoint)}, representing a critical demand zone that has been validated by ${supportTouches} touches.`;
    const p2 = `Momentum indicators show a Momentum Score of ${formatScore(report.scores?.momentum?.value)}/100, which aligns with the stock's systematic beta of ${formatNumber(stockBeta, 2)} and a Nifty 50 correlation coefficient of ${formatNumber(stockCorrelation, 2)}.`;
    const p3 = `From a macro perspective, the sector trend is classified as ${sectorTrend.toUpperCase()} with a Relative Strength Rating of ${formatScore(rsRating)}/100, reflecting a ${recommendation === 'BUY' ? 'strong accumulation' : 'tactical distribution'} profile.`;
    return [p1, p2, p3];
  };

  const calculateStrategyFallback = () => {
    const isBuy = recommendation === 'BUY';
    const entry = isBuy ? currentPrice : resistanceMidpoint * 1.01;
    const sl = entry * (isBuy ? 0.94 : 0.90);
    const t1 = entry * (isBuy ? 1.08 : 1.12);
    const t2 = entry * (isBuy ? 1.15 : 1.20);

    return {
      entry: formatPrice(entry),
      stopLoss: formatPrice(sl),
      target1: formatPrice(t1),
      target2: formatPrice(t2),
      holdingPeriod: isBuy ? "1 - 3 Months" : "Tactical Breakout Hold",
    };
  };

  // Rendering parameters
  const aiReport = report.ai_research_report;
  const thesisParagraphs = aiReport ? [aiReport.investment_thesis] : generateThesisParagraphs();
  const playbook = aiReport ? {
    entry: aiReport.trading_strategy.entry,
    stopLoss: aiReport.trading_strategy.stop_loss,
    target1: aiReport.trading_strategy.target_1,
    target2: aiReport.trading_strategy.target_2,
    holdingPeriod: aiReport.trading_strategy.expected_holding_period
  } : calculateStrategyFallback();

  const recColors = {
    BUY: 'text-bullish border-bullish/25 bg-bullish/5',
    WATCH: 'text-yellow-500 border-yellow-500/25 bg-yellow-500/5',
    AVOID: 'text-bearish border-bearish/25 bg-bearish/5',
    SELL: 'text-bearish border-bearish/25 bg-bearish/5',
    HOLD: 'text-yellow-500 border-yellow-500/25 bg-yellow-500/5',
  };

  return (
    <div className="relative rounded-2xl p-[1px] bg-gradient-to-br from-brand/50 via-borderDark to-borderDark shadow-premium overflow-hidden group">
      {/* Decorative backdrop glow */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-brand/10 rounded-full filter blur-[100px] pointer-events-none opacity-80" />

      {/* Main card body */}
      <div className="bg-surface rounded-[15px] p-6 flex flex-col gap-6 relative z-10 font-sans">
        
        {/* Header section with badge */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-borderDark/60 pb-5 gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-brand/10 border border-brand/20 flex items-center justify-center shadow-lg shadow-brand/10">
              <BrainCircuit className="w-5 h-5 text-brand" />
            </div>
            <div>
              <h3 className="font-bold text-lg text-white">AI Equity Intelligence & Investment Thesis</h3>
              <p className="text-xs text-textMuted mt-0.5">Comprehensive quantitative and systematic thesis for {name} ({ticker})</p>
            </div>
          </div>

          {/* Primary Badges */}
          <div className="flex items-center gap-3 self-start sm:self-auto font-mono">
            <div className={`flex items-center gap-2 px-4 py-2 border rounded-xl text-center min-w-[130px] justify-center ${recColors[recommendation] || recColors.WATCH}`}>
              <span className="text-[9px] text-textMuted uppercase">RECOMMENDATION:</span>
              <span className="text-xs font-black">{recommendation}</span>
            </div>

            <div className="flex items-center gap-2 bg-white/[0.02] border border-borderDark px-4 py-2 rounded-xl text-center min-w-[110px] justify-center">
              <span className="text-[9px] text-textMuted uppercase">CONFIDENCE:</span>
              <span className="text-xs font-black text-white">
                {formatPercentage(confidence)}
              </span>
            </div>
          </div>
        </div>

        {/* 1. Executive Summary & Thesis */}
        {aiReport && (
          <div className="flex flex-col gap-3 text-xs md:text-sm text-textMuted leading-relaxed max-w-5xl">
            <h4 className="text-xs font-bold font-mono text-white tracking-wider uppercase flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-brand" />
              <span>AI Executive Summary</span>
            </h4>
            <div className="bg-brand/5 border border-brand/20 p-4 rounded-xl text-white font-medium">
              {aiReport.executive_summary}
            </div>
          </div>
        )}

        <div className="flex flex-col gap-4 text-xs md:text-sm text-textMuted leading-relaxed max-w-5xl">
          <h4 className="text-xs font-bold font-mono text-white tracking-wider uppercase flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-brand" />
            <span>AI Investment Thesis</span>
          </h4>
          {thesisParagraphs.map((p, idx) => (
            <p key={idx} className="bg-white/[0.01] border border-borderDark/20 p-4 rounded-xl leading-relaxed">
              {p}
            </p>
          ))}
        </div>

        {aiReport && (
          <div className="flex flex-col gap-3 text-xs md:text-sm text-textMuted leading-relaxed max-w-5xl">
            <h4 className="text-xs font-bold font-mono text-white tracking-wider uppercase flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-brand" />
              <span>Recommendation Basis</span>
            </h4>
            <div className="bg-white/[0.01] border border-borderDark/20 p-4 rounded-xl leading-relaxed">
              {aiReport.recommendation_explanation}
            </div>
          </div>
        )}

        {/* 2. Bullish & Bearish Factors (5 catalysts each) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-2">
          {/* Bullish Catalysts */}
          <div className="bg-background border border-borderDark/40 p-5 rounded-xl flex flex-col gap-4">
            <h4 className="text-xs font-bold font-mono text-bullish tracking-wider uppercase flex items-center gap-1.5 border-b border-borderDark/40 pb-2">
              <ArrowUpRight className="w-4 h-4" />
              <span>Bullish Catalysts (Quantified)</span>
            </h4>
            <ul className="flex flex-col gap-3.5 text-xs text-textMuted">
              {aiReport ? (
                aiReport.bullish_factors.map((factor, idx) => (
                  <li key={idx} className="leading-relaxed">
                    <strong className="text-white block font-sans mb-0.5">{factor.title}</strong>
                    <span>{factor.explanation}</span>
                    {factor.evidence && factor.evidence.length > 0 && (
                      <span className="flex items-center gap-1 text-[9px] text-textMuted font-mono mt-1 bg-white/[0.02] w-fit px-1.5 py-0.5 rounded border border-borderDark">
                        <Info className="w-3 h-3" /> Trace variables: {factor.evidence.join(', ')}
                      </span>
                    )}
                  </li>
                ))
              ) : (
                <>
                  <li className="leading-relaxed">
                    <strong className="text-white block font-sans">Trend Alignment (Score: {formatScore(report.scores?.trend?.value)}/100):</strong>
                    Price action remains supported by swing pivot boundaries, showing buying pressure at the key demand zone near {formatPrice(supportMidpoint)}.
                  </li>
                  <li className="leading-relaxed">
                    <strong className="text-white block font-sans">Support Strength touches:</strong>
                    Solid demand clustering at {formatPrice(supportMidpoint)} with {supportTouches} touches confirms strong institutional accumulation.
                  </li>
                  <li className="leading-relaxed">
                    <strong className="text-white block font-sans">Volatility Regimes (ATR: {formatNumber(atrPct, 2)}%):</strong>
                    Ann. Volatility is stable at {formatNumber(annualizedVolatility, 1)}%, signaling pricing structure is consolidative.
                  </li>
                  <li className="leading-relaxed">
                    <strong className="text-white block font-sans">Relative Strength Rating ({formatScore(rsRating)}/100):</strong>
                    Percentile rating vs benchmark indexes indicates relative resilience during wider systematic drawdowns.
                  </li>
                  <li className="leading-relaxed">
                    <strong className="text-white block font-sans">Systematic Beta Profile:</strong>
                    Beta of {formatNumber(stockBeta, 2)} provides moderate exposure, protecting capital from extreme market volatility.
                  </li>
                </>
              )}
            </ul>
          </div>

          {/* Bearish Risks */}
          <div className="bg-background border border-borderDark/40 p-5 rounded-xl flex flex-col gap-4">
            <h4 className="text-xs font-bold font-mono text-bearish tracking-wider uppercase flex items-center gap-1.5 border-b border-borderDark/40 pb-2">
              <ArrowDownRight className="w-4 h-4" />
              <span>Bearish Risks (Quantified)</span>
            </h4>
            <ul className="flex flex-col gap-3.5 text-xs text-textMuted">
              {aiReport ? (
                aiReport.bearish_factors.map((factor, idx) => (
                  <li key={idx} className="leading-relaxed">
                    <strong className="text-white block font-sans mb-0.5">{factor.title}</strong>
                    <span>{factor.explanation}</span>
                    {factor.evidence && factor.evidence.length > 0 && (
                      <span className="flex items-center gap-1 text-[9px] text-textMuted font-mono mt-1 bg-white/[0.02] w-fit px-1.5 py-0.5 rounded border border-borderDark">
                        <Info className="w-3 h-3" /> Trace variables: {factor.evidence.join(', ')}
                      </span>
                    )}
                  </li>
                ))
              ) : (
                <>
                  <li className="leading-relaxed">
                    <strong className="text-white block font-sans">Overhead Resistance Ceiling:</strong>
                    Substantial supply overhang at {formatPrice(resistanceMidpoint)} with {resistanceTouches} touches acts as a strong short-term barrier.
                  </li>
                  <li className="leading-relaxed">
                    <strong className="text-white block font-sans">Bearish Market Drag:</strong>
                    Nifty direction is currently {niftyTrend.toUpperCase()} ({formatScore(niftyStrength)}/100), creating systematic index headwind.
                  </li>
                  <li className="leading-relaxed">
                    <strong className="text-white block font-sans">Systematic Correlation Drag:</strong>
                    A high Pearson correlation of {formatNumber(stockCorrelation, 2)} vs Nifty increases systematic selloff exposure.
                  </li>
                  <li className="leading-relaxed">
                    <strong className="text-white block font-sans">Consolidation Volume Profile:</strong>
                    Momentum Score is {formatScore(report.scores?.momentum?.value)}/100, showing a lack of aggressive buyer volume validation.
                  </li>
                  <li className="leading-relaxed">
                    <strong className="text-white block font-sans">Sector Drag:</strong>
                    {sectorName} index trend is {sectorTrend.toUpperCase()} ({formatScore(sectorStrength)}/100), offering weak group tailwinds.
                  </li>
                </>
              )}
            </ul>
          </div>
        </div>

        {/* Technical Outlook & Market Context Interpretation */}
        {aiReport && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-2">
            <div className="bg-background border border-borderDark/40 p-5 rounded-xl flex flex-col gap-4">
              <h4 className="text-xs font-bold font-mono text-white tracking-wider uppercase flex items-center gap-1.5 border-b border-borderDark/40 pb-2">
                <BarChart3 className="w-4 h-4 text-brand" />
                <span>Technical Indicators Interpretation</span>
              </h4>
              <p className="text-xs text-textMuted leading-relaxed">
                {aiReport.technical_outlook}
              </p>
            </div>
            <div className="bg-background border border-borderDark/40 p-5 rounded-xl flex flex-col gap-4">
              <h4 className="text-xs font-bold font-mono text-white tracking-wider uppercase flex items-center gap-1.5 border-b border-borderDark/40 pb-2">
                <Sparkles className="w-4 h-4 text-brand" />
                <span>Broad Market Context Impact</span>
              </h4>
              <p className="text-xs text-textMuted leading-relaxed">
                {aiReport.market_context}
              </p>
            </div>
          </div>
        )}

        {/* 3. Technical Evidence Table */}
        <div className="bg-background border border-borderDark/40 p-5 rounded-xl flex flex-col gap-4 mt-2">
          <h4 className="text-xs font-bold font-mono text-white tracking-wider uppercase flex items-center gap-1.5">
            <BarChart3 className="w-4 h-4 text-brand" />
            <span>Traceable Technical Evidence Ledger</span>
          </h4>
          <div className="overflow-x-auto">
            <table className="w-full text-left font-mono text-xs border-collapse">
              <thead>
                <tr className="border-b border-borderDark/60 text-textMuted uppercase text-[10px]">
                  <th className="pb-2">Quantitative Dimension</th>
                  <th className="pb-2">Engine Score</th>
                  <th className="pb-2">Systematic Metric</th>
                  <th className="pb-2">Weight</th>
                  <th className="pb-2">Contribution</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-borderDark/40 text-white">
                <tr>
                  <td className="py-2.5">Trend Horizons</td>
                  <td>{formatScore(report.scores?.trend?.value)} / 100</td>
                  <td>SMA / EMA Position</td>
                  <td>{formatNumber(report.scores?.trend?.weight, 2)}</td>
                  <td>{formatNumber(report.scores?.trend?.contribution, 1)} pts</td>
                </tr>
                <tr>
                  <td className="py-2.5">Momentum Horizons</td>
                  <td>{formatScore(report.scores?.momentum?.value)} / 100</td>
                  <td>Index RSI: {formatNumber(niftyMomentum, 1)}</td>
                  <td>{formatNumber(report.scores?.momentum?.weight, 2)}</td>
                  <td>{formatNumber(report.scores?.momentum?.contribution, 1)} pts</td>
                </tr>
                <tr>
                  <td className="py-2.5">Relative Strength</td>
                  <td>{formatScore(rsRating)} / 100</td>
                  <td>Sector RSNifty: {formatNumber(sectorRSNifty, 2)}</td>
                  <td>--</td>
                  <td>Systematic</td>
                </tr>
                <tr>
                  <td className="py-2.5">Risk & Volatility</td>
                  <td>{formatScore(report.scores?.volatility?.value)} / 100</td>
                  <td>ATR: {formatNumber(atrPct, 2)}% | VIX: {formatNumber(vixValue, 1)}</td>
                  <td>{formatNumber(report.scores?.volatility?.weight, 2)}</td>
                  <td>{formatNumber(report.scores?.volatility?.contribution, 1)} pts</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* 4. Trading Strategy & Invalidation Bounds */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-2">
          {/* Trading targets */}
          <div className="bg-background border border-borderDark/40 p-5 rounded-xl flex flex-col gap-4">
            <h4 className="text-xs font-bold font-mono text-white tracking-wider uppercase flex items-center gap-1.5 border-b border-borderDark/40 pb-2">
              <Zap className="w-4 h-4 text-brand" />
              <span>Suggested Trading Playbook</span>
            </h4>
            <div className="grid grid-cols-2 gap-4 font-mono text-xs text-textMuted">
              <div>
                <span>SUGGESTED ENTRY:</span>
                <strong className="block text-sm text-white font-sans mt-0.5">{playbook.entry}</strong>
              </div>
              <div>
                <span>STOP LOSS:</span>
                <strong className="block text-sm text-bearish font-sans mt-0.5">{playbook.stopLoss}</strong>
              </div>
              <div>
                <span>TARGET 1 (CONSERVATIVE):</span>
                <strong className="block text-sm text-bullish font-sans mt-0.5">{playbook.target1}</strong>
              </div>
              <div>
                <span>TARGET 2 (EXTENDED):</span>
                <strong className="block text-sm text-bullish font-sans mt-0.5">{playbook.target2}</strong>
              </div>
              <div>
                <span>RISK CATEGORY:</span>
                <strong className="block text-xs text-white font-sans mt-0.5">{riskLevel.toUpperCase()}</strong>
              </div>
              <div>
                <span>HOLDING TIME HORIZON:</span>
                <strong className="block text-xs text-white font-sans mt-0.5">{playbook.holdingPeriod}</strong>
              </div>
            </div>
          </div>

          {/* Thesis Invalidation bounds */}
          <div className="bg-background border border-borderDark/40 p-5 rounded-xl flex flex-col gap-4">
            <h4 className="text-xs font-bold font-mono text-white tracking-wider uppercase flex items-center gap-1.5 border-b border-borderDark/40 pb-2">
              <ShieldCheck className="w-4 h-4 text-brand" />
              <span>Thesis Invalidation Parameters</span>
            </h4>
            <div className="flex flex-col gap-3 text-xs text-textMuted leading-relaxed">
              {aiReport ? (
                <p>{aiReport.invalidation_conditions}</p>
              ) : (
                <ul className="flex flex-col gap-2.5">
                  <li className="leading-relaxed">
                    <strong className="text-white block font-sans">Support Breach invalidation:</strong>
                    A daily closing print below key zone midpoint of <span className="text-white font-mono">{formatPrice(supportMidpoint)}</span> invalidates the current bullish structure.
                  </li>
                  <li className="leading-relaxed">
                    <strong className="text-white block font-sans">Index Volatility Surge:</strong>
                    A spike in INDIA VIX above <span className="text-white font-mono">18.00</span> triggers exit logic.
                  </li>
                </ul>
              )}
            </div>
          </div>
        </div>

        {/* Concluding Verdict */}
        {aiReport && (
          <div className="bg-brand/5 border border-brand/20 p-5 rounded-xl flex flex-col gap-2 mt-2">
            <h4 className="text-xs font-bold font-mono text-white tracking-wider uppercase flex items-center gap-1.5 border-b border-brand/20 pb-2">
              <BrainCircuit className="w-4 h-4 text-brand" />
              <span>Final Research Verdict</span>
            </h4>
            <p className="text-xs text-white leading-relaxed font-medium">
              {aiReport.final_verdict}
            </p>
            {aiReport.metadata && (
              <span className="text-[9px] text-textMuted font-mono mt-2 block self-end">
                Intelligence Model: {aiReport.metadata.model} (v{aiReport.metadata.prompt_version}) | Latency: {aiReport.metadata.response_time_ms}ms {aiReport.metadata.cached ? '[CACHED]' : ''}
              </span>
            )}
          </div>
        )}

      </div>
    </div>
  );
};
