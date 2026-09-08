import React, { useState } from 'react';
import { Sparkles, BrainCircuit, ArrowUpRight, ArrowDownRight, BarChart3, ShieldCheck, Zap, Info, ShieldAlert, Clock, FileText, ChevronDown, ChevronUp, Terminal } from 'lucide-react';
import { DeterministicAnalysisReport, SectionWithEvidence, FactorEvidence } from '../types';
import { formatPercentage, formatNumber, formatScore, formatPrice } from '../utils/formatter';
import { MarketIntelligenceSection } from './MarketIntelligenceSection';

interface AIResearchPanelProps {
  report: DeterministicAnalysisReport;
}

export const AIResearchPanel: React.FC<AIResearchPanelProps> = ({ report }) => {
  const [showDiagnostics, setShowDiagnostics] = useState(false);

  const name = report.company_name || 'Stock';
  const ticker = report.ticker || 'STOCK';
  const recommendation = report.prediction?.recommendation || report.recommendation || report.scores?.recommendation || 'HOLD';
  const confidence = report.prediction?.confidence ?? report.scores?.confidence ?? 50.0;
  const overallScore = report.scores?.overall_score ?? 50.0;
  const score = overallScore;
  
  const closes = report.chart_data?.close || [];
  const currentPrice = closes[closes.length - 1] || 0.0;

  const supportTouches = report.support_zones?.[0]?.touches ?? 3;
  const resistanceTouches = report.resistance_zones?.[0]?.touches ?? 4;
  const supportMidpoint = report.support_zones?.[0] 
    ? (report.support_zones[0].upper_bound + report.support_zones[0].lower_bound) / 2.0 
    : currentPrice * 0.95;
  const resistanceMidpoint = report.resistance_zones?.[0]
    ? (report.resistance_zones[0].upper_bound + report.resistance_zones[0].lower_bound) / 2.0
    : currentPrice * 1.05;

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

  const parseNumericPrice = (strVal: any): number | null => {
    if (typeof strVal === 'number') return strVal;
    if (typeof strVal === 'string') {
      const cleaned = strVal.replace(/[^0-9.]/g, '');
      const num = parseFloat(cleaned);
      return !isNaN(num) ? num : null;
    }
    return null;
  };

  const calculateStrategyFallback = () => {
    const isBuy = ['STRONG BUY', 'BUY', 'ACCUMULATE'].includes(recommendation);
    const entry = currentPrice > 0 ? currentPrice : supportMidpoint;
    const sl = Number((entry * 0.95).toFixed(2));
    const t1 = Number((entry * 1.08).toFixed(2));
    const t2 = Number((entry * 1.15).toFixed(2));

    return {
      entry: formatPrice(entry),
      stopLoss: formatPrice(sl),
      target1: formatPrice(t1),
      target2: formatPrice(t2),
      holdingPeriod: isBuy ? "1 - 3 Months" : "Tactical Position Hold",
    };
  };

  const aiReport = report.ai_research_report;
  const rawPlaybook = (aiReport && aiReport.trading_strategy) ? {
    entry: aiReport.trading_strategy.entry,
    stopLoss: aiReport.trading_strategy.stop_loss,
    target1: aiReport.trading_strategy.target_1,
    target2: aiReport.trading_strategy.target_2,
    holdingPeriod: aiReport.trading_strategy.expected_holding_period
  } : calculateStrategyFallback();

  const validatePlaybook = (pb: any) => {
    if (!pb) return calculateStrategyFallback();

    const entryNum = parseNumericPrice(pb.entry) ?? currentPrice;
    const slNum = parseNumericPrice(pb.stopLoss);
    const t1Num = parseNumericPrice(pb.target1);
    const t2Num = parseNumericPrice(pb.target2);

    if (currentPrice > 0 && slNum && t1Num) {
      const isSlValid = slNum < entryNum && slNum < currentPrice;
      const isTargetValid = entryNum < t1Num && (!t2Num || t1Num < t2Num);
      const isEntryRel = Math.abs(entryNum - currentPrice) / currentPrice <= 0.08;
      const risk = entryNum - slNum;
      const reward = t1Num - entryNum;
      const isRrValid = risk > 0 && reward > risk;

      if (isSlValid && isTargetValid && isEntryRel && isRrValid) {
        return pb;
      }
    }

    // Regeneration on validation failure
    return calculateStrategyFallback();
  };

  const playbook = validatePlaybook(rawPlaybook);

  const recColors: Record<string, string> = {
    'STRONG BUY': 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10 font-bold',
    'BUY': 'text-bullish border-bullish/30 bg-bullish/10 font-bold',
    'ACCUMULATE': 'text-teal-300 border-teal-500/30 bg-teal-500/10 font-bold',
    'HOLD': 'text-yellow-400 border-yellow-500/30 bg-yellow-500/10 font-bold',
    'REDUCE': 'text-orange-400 border-orange-500/30 bg-orange-500/10 font-bold',
    'SELL': 'text-bearish border-bearish/30 bg-bearish/10 font-bold',
    'STRONG SELL': 'text-rose-400 border-rose-600/30 bg-rose-600/10 font-bold',
  };

  const renderSectionText = (section: SectionWithEvidence | string | undefined, fallbackText?: string) => {
    if (!section && !fallbackText) return null;
    const text = typeof section === 'object' ? section.text : (section || fallbackText || '');
    const evidence = typeof section === 'object' ? section.evidence : [];

    return (
      <div className="flex flex-col gap-2">
        <p className="leading-relaxed text-xs md:text-sm text-textMuted">{text}</p>
        {evidence && evidence.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 mt-1">
            <span className="text-[9px] text-textMuted font-mono mr-1 flex items-center gap-1">
              <Info className="w-2.5 h-2.5 text-brand" /> Trace Evidence:
            </span>
            {evidence.map((tag, idx) => (
              <span key={idx} className="text-[9px] text-brand bg-brand/10 border border-brand/20 px-2 py-0.5 rounded font-mono">
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
    );
  };

  const deduplicateFactors = (factors: FactorEvidence[] = [], maxCount = 5): FactorEvidence[] => {
    const seenTitles = new Set<string>();
    const unique: FactorEvidence[] = [];
    
    for (const f of factors) {
      if (!f || !f.title) continue;
      const cleanKey = f.title.replace(/^(Supportive Factor \d+:|Risk Factor \d+:|Market Risk \d+:)\s*/i, '').trim().toLowerCase();
      if (!seenTitles.has(cleanKey)) {
        seenTitles.add(cleanKey);
        unique.push({
          ...f,
          title: f.title.replace(/^(Supportive Factor \d+:|Risk Factor \d+:|Market Risk \d+:)\s*/i, '').trim()
        });
      }
      if (unique.length >= maxCount) break;
    }
    return unique;
  };

  const rawBull: FactorEvidence[] = (aiReport?.bull_case || aiReport?.bullish_factors || []).length > 0
    ? (aiReport?.bull_case || aiReport?.bullish_factors || [])
    : [
        { title: `Trend Alignment (${formatScore(report.scores?.trend?.value)}/100)`, explanation: `Price action remains supported above key pivot zones, showing demand near ${formatPrice(supportMidpoint)}.`, evidence: ['trend_score', 'support_levels'] },
        { title: `Support Zone Validation`, explanation: `Demand clustering near ${formatPrice(supportMidpoint)} with ${supportTouches} touches confirms buying interest.`, evidence: ['support_levels'] },
        { title: `Relative Strength (${formatScore(rsRating)}/100)`, explanation: `Percentile rating indicates resilience against broader market drawdowns.`, evidence: ['relative_strength_rating'] }
      ];

  const rawBear: FactorEvidence[] = (aiReport?.bear_case || aiReport?.bearish_factors || []).length > 0
    ? (aiReport?.bear_case || aiReport?.bearish_factors || [])
    : [
        { title: `Overhead Resistance`, explanation: `Supply overhang near ${formatPrice(resistanceMidpoint)} with ${resistanceTouches} touches acts as ceiling.`, evidence: ['resistance_levels'] },
        { title: `Market Direction Drag`, explanation: `Nifty 50 trend is ${niftyTrend} (${formatScore(niftyStrength)}/100), creating systematic index headwind.`, evidence: ['nifty_direction'] }
      ];

  const rawRisks: FactorEvidence[] = (aiReport?.key_risks || []).length > 0
    ? aiReport!.key_risks
    : [
        { title: `Systematic Beta Exposure`, explanation: `Beta of ${formatNumber(stockBeta, 2)} with correlation ${formatNumber(stockCorrelation, 2)} transmits market pullbacks.`, evidence: ['stock_beta', 'stock_correlation'] },
        { title: `Volatility Buffer (ATR: ${formatNumber(atrPct, 2)}%)`, explanation: `Annualized volatility at ${formatNumber(annualizedVolatility, 1)}% requires strict stop discipline.`, evidence: ['atr_percentage', 'annualized_volatility'] }
      ];

  const bullFactors = deduplicateFactors(rawBull, 5);
  const bearFactors = deduplicateFactors(rawBear, 5);
  const keyRisks = deduplicateFactors(rawRisks, 5);

  const scoringMeta = (report.metadata as any)?.scoring_explanation || {};
  const riskPenalties = scoringMeta.risk_penalties || {};

  return (
    <div className="relative rounded-2xl p-[1px] bg-gradient-to-br from-brand/50 via-borderDark to-borderDark shadow-premium overflow-hidden group">
      <div className="absolute top-0 right-0 w-96 h-96 bg-brand/10 rounded-full filter blur-[100px] pointer-events-none opacity-80" />

      <div className="bg-surface rounded-[15px] p-6 flex flex-col gap-6 relative z-10 font-sans">
        
        {/* Header section with badges */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-borderDark/60 pb-5 gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-brand/10 border border-brand/20 flex items-center justify-center shadow-lg shadow-brand/10">
              <BrainCircuit className="w-5 h-5 text-brand" />
            </div>
            <div>
              <h3 className="font-bold text-lg text-white">AI Equity Intelligence & Investment Thesis</h3>
              <p className="text-xs text-textMuted mt-0.5">Comprehensive quantitative report for {name} ({ticker})</p>
            </div>
          </div>

          <div className="flex items-center gap-3 self-start sm:self-auto font-mono">
            <div className={`flex items-center gap-2 px-4 py-2 border rounded-xl text-center min-w-[130px] justify-center ${recColors[recommendation] || recColors.WATCH}`}>
              <span className="text-[9px] text-textMuted uppercase">RECOMMENDATION:</span>
              <span className="text-xs font-black">{recommendation}</span>
            </div>

            <div className="flex items-center gap-2 px-4 py-2 border border-borderDark bg-background rounded-xl text-center min-w-[120px] justify-center">
              <span className="text-[9px] text-textMuted uppercase">CONFIDENCE:</span>
              <span className="text-xs font-black text-white">{formatPercentage(confidence, 0)}</span>
            </div>

            <div className="flex items-center gap-2 px-4 py-2 border border-borderDark bg-background rounded-xl text-center min-w-[110px] justify-center">
              <span className="text-[9px] text-textMuted uppercase">RISK:</span>
              <span className="text-xs font-black text-white">{riskLevel.toUpperCase()}</span>
            </div>
          </div>
        </div>

        {/* 1. Investment Thesis */}
        <div className="bg-background border border-borderDark/40 p-5 rounded-xl flex flex-col gap-3">
          <div className="flex items-center justify-between border-b border-borderDark/40 pb-2">
            <h4 className="text-xs font-bold font-mono text-white tracking-wider uppercase flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-brand" />
              <span>Institutional Executive Summary</span>
            </h4>
            <span className="text-[10px] font-mono text-textMuted">TECHNICAL SCORE: {formatScore(score)}/100</span>
          </div>
          {renderSectionText(
            aiReport?.investment_thesis,
            `Quantitative scoring engine calculates an overall technical score of ${formatScore(score)}/100 for ${name}. Model signals indicate a ${recommendation} stance with ${formatPercentage(confidence, 0)} confidence under active ${riskLevel} risk market conditions.`
          )}
        </div>

        {/* 2. Bull & Bear Cases + Key Risks */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-1">
          {/* Bull Case */}
          <div className="bg-background border border-borderDark/40 p-5 rounded-xl flex flex-col gap-4">
            <h4 className="text-xs font-bold font-mono text-bullish tracking-wider uppercase flex items-center gap-1.5 border-b border-borderDark/40 pb-2">
              <ArrowUpRight className="w-4 h-4" />
              <span>Bull Case (Unique Catalysts)</span>
            </h4>
            <ul className="flex flex-col gap-3.5 text-xs text-textMuted">
              {bullFactors.map((factor, idx) => (
                <li key={idx} className="leading-relaxed">
                  <strong className="text-white block font-sans mb-0.5">{factor.title}</strong>
                  <span>{factor.explanation}</span>
                  {factor.evidence && factor.evidence.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1 font-mono text-[9px] text-brand">
                      {factor.evidence.map((e, eIdx) => (
                        <span key={eIdx} className="bg-brand/10 border border-brand/20 px-1.5 py-0.2 rounded">
                          {e}
                        </span>
                      ))}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>

          {/* Bear Case */}
          <div className="bg-background border border-borderDark/40 p-5 rounded-xl flex flex-col gap-4">
            <h4 className="text-xs font-bold font-mono text-bearish tracking-wider uppercase flex items-center gap-1.5 border-b border-borderDark/40 pb-2">
              <ArrowDownRight className="w-4 h-4" />
              <span>Bear Case (Supply Ceilings)</span>
            </h4>
            <ul className="flex flex-col gap-3.5 text-xs text-textMuted">
              {bearFactors.map((factor, idx) => (
                <li key={idx} className="leading-relaxed">
                  <strong className="text-white block font-sans mb-0.5">{factor.title}</strong>
                  <span>{factor.explanation}</span>
                  {factor.evidence && factor.evidence.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1 font-mono text-[9px] text-brand">
                      {factor.evidence.map((e, eIdx) => (
                        <span key={eIdx} className="bg-brand/10 border border-brand/20 px-1.5 py-0.2 rounded">
                          {e}
                        </span>
                      ))}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>

          {/* Key Risks */}
          <div className="bg-background border border-borderDark/40 p-5 rounded-xl flex flex-col gap-4">
            <h4 className="text-xs font-bold font-mono text-yellow-500 tracking-wider uppercase flex items-center gap-1.5 border-b border-borderDark/40 pb-2">
              <ShieldAlert className="w-4 h-4" />
              <span>Key Structural Risks</span>
            </h4>
            <ul className="flex flex-col gap-3.5 text-xs text-textMuted">
              {keyRisks.map((factor, idx) => (
                <li key={idx} className="leading-relaxed">
                  <strong className="text-white block font-sans mb-0.5">{factor.title}</strong>
                  <span>{factor.explanation}</span>
                  {factor.evidence && factor.evidence.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1 font-mono text-[9px] text-brand">
                      {factor.evidence.map((e, eIdx) => (
                        <span key={eIdx} className="bg-brand/10 border border-brand/20 px-1.5 py-0.2 rounded">
                          {e}
                        </span>
                      ))}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* 3. Technical, Short-Term, & Medium-Term Outlook */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-1">
          <div className="bg-background border border-borderDark/40 p-5 rounded-xl flex flex-col gap-3">
            <h4 className="text-xs font-bold font-mono text-white tracking-wider uppercase flex items-center gap-1.5 border-b border-borderDark/40 pb-2">
              <BarChart3 className="w-4 h-4 text-brand" />
              <span>Technical Outlook</span>
            </h4>
            {renderSectionText(
              aiReport?.technical_outlook,
              `Moving averages indicate Trend Score at ${formatScore(report.scores?.trend?.value)}/100 and Momentum Score at ${formatScore(report.scores?.momentum?.value)}/100.`
            )}
          </div>

          <div className="bg-background border border-borderDark/40 p-5 rounded-xl flex flex-col gap-3">
            <h4 className="text-xs font-bold font-mono text-white tracking-wider uppercase flex items-center gap-1.5 border-b border-borderDark/40 pb-2">
              <Clock className="w-4 h-4 text-brand" />
              <span>Short-Term (1-5 Days)</span>
            </h4>
            {renderSectionText(
              aiReport?.short_term_outlook,
              `Tactical bias is ${recommendation} with market regime classified as ${scoringMeta.regime || 'trending'}.`
            )}
          </div>

          <div className="bg-background border border-borderDark/40 p-5 rounded-xl flex flex-col gap-3">
            <h4 className="text-xs font-bold font-mono text-white tracking-wider uppercase flex items-center gap-1.5 border-b border-borderDark/40 pb-2">
              <ShieldCheck className="w-4 h-4 text-brand" />
              <span>Medium-Term (1-3 Months)</span>
            </h4>
            {renderSectionText(
              aiReport?.medium_term_outlook,
              `Strategic horizon depends on holding pivot demand boundaries near ${formatPrice(supportMidpoint)}.`
            )}
          </div>
        </div>

        {/* 4. Action Plan & Trading Playbook */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-1">
          {/* Action Plan */}
          <div className="bg-background border border-borderDark/40 p-5 rounded-xl flex flex-col gap-3">
            <h4 className="text-xs font-bold font-mono text-white tracking-wider uppercase flex items-center gap-1.5 border-b border-borderDark/40 pb-2">
              <Zap className="w-4 h-4 text-brand" />
              <span>Execution Action Plan</span>
            </h4>
            {renderSectionText(
              aiReport?.action_plan,
              `Suggested execution parameters: ${playbook.entry}. Maintain stop loss at ${playbook.stopLoss}.`
            )}
          </div>

          {/* Playbook Targets */}
          <div className="bg-background border border-borderDark/40 p-5 rounded-xl flex flex-col gap-3">
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
            </div>
          </div>
        </div>

        {/* 5. Traceable Technical Evidence Ledger Table */}
        <div className="bg-background border border-borderDark/40 p-5 rounded-xl flex flex-col gap-4 mt-1">
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

        {/* 6. Market Intelligence Feed Section (Phase 12) */}
        <MarketIntelligenceSection intelligencePack={report.intelligence_pack} ticker={ticker} />

        {/* 7. Diagnostics Collapsible Drawer (Requirement 8) */}
        <div className="bg-background border border-borderDark/40 rounded-xl overflow-hidden mt-1">
          <button
            onClick={() => setShowDiagnostics(!showDiagnostics)}
            className="w-full p-4 flex items-center justify-between bg-surface/50 hover:bg-surface transition-all text-xs font-mono text-white font-bold"
          >
            <div className="flex items-center gap-2">
              <Terminal className="w-4 h-4 text-brand" />
              <span>QUANTITATIVE ENGINE DIAGNOSTICS & SCORE AUDIT</span>
            </div>
            <div className="flex items-center gap-1.5 text-textMuted">
              <span>{showDiagnostics ? 'Hide Breakdown' : 'Show Breakdown'}</span>
              {showDiagnostics ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </div>
          </button>

          {showDiagnostics && (
            <div className="p-5 border-t border-borderDark/40 flex flex-col gap-5 text-xs font-mono">
              {/* Positive Contributors */}
              <div className="flex flex-col gap-2">
                <span className="text-[10px] text-bullish font-bold uppercase tracking-wider">Positive Contributors ({report.positive_factors?.length || 0})</span>
                <div className="flex flex-wrap gap-2">
                  {(report.positive_factors || []).map((f, i) => (
                    <span key={i} className="px-2.5 py-1 rounded-md bg-bullish/10 border border-bullish/20 text-bullish text-[11px]">
                      + {f}
                    </span>
                  ))}
                  {(!report.positive_factors || report.positive_factors.length === 0) && (
                    <span className="text-textMuted italic">No positive contributors flagged.</span>
                  )}
                </div>
              </div>

              {/* Negative Contributors */}
              <div className="flex flex-col gap-2">
                <span className="text-[10px] text-bearish font-bold uppercase tracking-wider">Negative Contributors ({report.negative_factors?.length || 0})</span>
                <div className="flex flex-wrap gap-2">
                  {(report.negative_factors || []).map((f, i) => (
                    <span key={i} className="px-2.5 py-1 rounded-md bg-bearish/10 border border-bearish/20 text-bearish text-[11px]">
                      - {f}
                    </span>
                  ))}
                  {(!report.negative_factors || report.negative_factors.length === 0) && (
                    <span className="text-textMuted italic">No negative contributors flagged.</span>
                  )}
                </div>
              </div>

              {/* Risk Deductions Table */}
              <div className="flex flex-col gap-2 pt-2 border-t border-borderDark/40">
                <span className="text-[10px] text-yellow-500 font-bold uppercase tracking-wider">Risk Deduction Breakdown</span>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-surface p-3 rounded-lg border border-borderDark/40">
                  <div>
                    <span className="text-[9px] text-textMuted block">BETA PENALTY</span>
                    <strong className="text-white">{formatNumber(riskPenalties.beta_penalty ?? 0.0, 2)} pts</strong>
                  </div>
                  <div>
                    <span className="text-[9px] text-textMuted block">VIX PENALTY</span>
                    <strong className="text-white">{formatNumber(riskPenalties.vix_penalty ?? 0.0, 2)} pts</strong>
                  </div>
                  <div>
                    <span className="text-[9px] text-textMuted block">RVOL PENALTY</span>
                    <strong className="text-white">{formatNumber(riskPenalties.rvol_penalty ?? 0.0, 2)} pts</strong>
                  </div>
                  <div>
                    <span className="text-[9px] text-textMuted block">TOTAL RISK PENALTY</span>
                    <strong className="text-bearish">{formatNumber(riskPenalties.total_penalty ?? 0.0, 2)} pts</strong>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 7. Disclaimer & Metadata */}
        <div className="bg-brand/5 border border-brand/20 p-5 rounded-xl flex flex-col gap-3 mt-1">
          <div className="flex items-center gap-2 text-xs font-bold font-mono text-white tracking-wider uppercase border-b border-brand/20 pb-2">
            <FileText className="w-4 h-4 text-brand" />
            <span>Research Disclaimer & Audit Metadata</span>
          </div>
          <p className="text-xs text-textMuted leading-relaxed">
            {aiReport?.disclaimer || "This report is generated strictly for informational and educational purposes by an automated quantitative analysis engine. It does not constitute financial advice or a personalized investment recommendation."}
          </p>
          {aiReport?.metadata && (
            <span className="text-[9px] text-textMuted font-mono block self-end">
              Model: {aiReport.metadata.model} (v{aiReport.metadata.prompt_version}) | Latency: {aiReport.metadata.response_time_ms}ms {aiReport.metadata.cached ? '[CACHED]' : ''} {aiReport.metadata.fallback_reason ? `[FALLBACK: ${aiReport.metadata.fallback_reason}]` : ''}
            </span>
          )}
        </div>

      </div>
    </div>
  );
};
