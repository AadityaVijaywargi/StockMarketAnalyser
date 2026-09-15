import { describe, expect, it } from 'vitest';
import { findSectorAlternatives, pickBuyAvoid, ScoredSlot } from './compare_suggestions';

const slot = (ticker: string, overall_score: number, sector_name?: string): ScoredSlot => ({
  ticker,
  report: { scores: { overall_score }, market_context: { sector: { sector_name } } },
});
const loading = (ticker: string): ScoredSlot => ({ ticker, report: null });

describe('pickBuyAvoid', () => {
  it('picks the highest score to buy and the lowest to avoid', () => {
    const { buyPick, avoidPick } = pickBuyAvoid([slot('TCS.NS', 62), slot('INFY.NS', 78), slot('WIPRO.NS', 41)]);
    expect(buyPick?.ticker).toBe('INFY.NS');
    expect(avoidPick?.ticker).toBe('WIPRO.NS');
  });

  it('needs at least two loaded stocks', () => {
    expect(pickBuyAvoid([slot('TCS.NS', 62)])).toEqual({ buyPick: null, avoidPick: null });
    expect(pickBuyAvoid([slot('TCS.NS', 62), loading('INFY.NS')])).toEqual({ buyPick: null, avoidPick: null });
  });

  it('ignores stocks that are still loading', () => {
    const { buyPick, avoidPick } = pickBuyAvoid([loading('HDFCBANK.NS'), slot('TCS.NS', 50), slot('INFY.NS', 70)]);
    expect(buyPick?.ticker).toBe('INFY.NS');
    expect(avoidPick?.ticker).toBe('TCS.NS');
  });

  it('makes no pick when every stock scores the same', () => {
    expect(pickBuyAvoid([slot('TCS.NS', 60), slot('INFY.NS', 60)])).toEqual({ buyPick: null, avoidPick: null });
  });

  it('does not reorder the caller\'s array', () => {
    const slots = [slot('A', 10), slot('B', 90)];
    pickBuyAvoid(slots);
    expect(slots.map(s => s.ticker)).toEqual(['A', 'B']);
  });
});

describe('findSectorAlternatives', () => {
  const opportunities = [
    { ticker: 'HCLTECH.NS', sector: 'IT', overall_score: 85 },
    { ticker: 'TECHM.NS', sector: 'IT', overall_score: 70 },
    { ticker: 'SBIN.NS', sector: 'Banking', overall_score: 55 },
  ];

  it('suggests the top same-sector stock only when it beats every compared stock in that sector', () => {
    const result = findSectorAlternatives([slot('TCS.NS', 62, 'IT'), slot('INFY.NS', 78, 'IT')], opportunities);
    expect(result).toHaveLength(1);
    expect(result[0].sectorName).toBe('IT');
    expect(result[0].alt.ticker).toBe('HCLTECH.NS');
    expect(result[0].bestInGroup.ticker).toBe('INFY.NS');
    expect(result[0].comparedTickers).toEqual(['TCS.NS', 'INFY.NS']);
  });

  it('never suggests an alternative that is not strictly better', () => {
    expect(findSectorAlternatives([slot('HDFCBANK.NS', 55, 'Banking')], opportunities)).toEqual([]);
  });

  it('never suggests a stock that is already being compared (case/whitespace-insensitive)', () => {
    const result = findSectorAlternatives([slot('TCS.NS', 62, 'IT'), slot(' hcltech.ns ', 60, 'IT')], opportunities);
    expect(result[0].alt.ticker).toBe('TECHM.NS');
  });

  it('skips generic sector labels and stocks without a sector', () => {
    const generic = [{ ticker: 'X.NS', sector: 'General Market', overall_score: 99 }];
    expect(findSectorAlternatives([slot('A.NS', 10, 'General Market'), slot('B.NS', 10)], generic)).toEqual([]);
  });
});
