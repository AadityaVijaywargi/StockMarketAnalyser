import { describe, expect, it } from 'vitest';
import { isPlaybookValid, parseNumericPrice } from './playbook_validation';

describe('parseNumericPrice', () => {
  it('passes finite numbers through and rejects non-finite / non-string input', () => {
    expect(parseNumericPrice(2450.5)).toBe(2450.5);
    expect(parseNumericPrice(NaN)).toBeNull();
    expect(parseNumericPrice(undefined)).toBeNull();
    expect(parseNumericPrice({})).toBeNull();
  });

  it('parses the formats the backend and formatter actually emit', () => {
    expect(parseNumericPrice('Market Entry at 2450.00')).toBe(2450);
    expect(parseNumericPrice('Hard stop at 2327.50 (close below)')).toBe(2327.5);
    expect(parseNumericPrice('₹1,23,456.75')).toBe(123456.75);
  });

  it('does not let currency abbreviations corrupt the number', () => {
    // Previously every non-digit was stripped, so "Rs. 2,450" became ".2450" -> 0.245.
    expect(parseNumericPrice('Rs. 2,450')).toBe(2450);
    expect(parseNumericPrice('INR 980.40')).toBe(980.4);
  });

  it('does not merge "Target 1" / "T2" labels into the price', () => {
    // Previously "Target 1: 2500" became "12500".
    expect(parseNumericPrice('Target 1: 2500')).toBe(2500);
    expect(parseNumericPrice('T2 - ₹2,700')).toBe(2700);
  });

  it('returns null when there is no number', () => {
    expect(parseNumericPrice('Wait for confirmation')).toBeNull();
  });
});

describe('isPlaybookValid', () => {
  const price = 1000;
  const good = { entry: 1000, stopLoss: 950, target1: 1080, target2: 1150 };

  it('accepts a setup that satisfies the invariant', () => {
    expect(isPlaybookValid(good, price)).toBe(true);
    expect(isPlaybookValid({ ...good, target2: undefined }, price)).toBe(true);
  });

  it('rejects a stop loss at or above the current price', () => {
    expect(isPlaybookValid({ ...good, stopLoss: 1000 }, price)).toBe(false);
    expect(isPlaybookValid({ ...good, entry: 1050, stopLoss: 1010, target1: 1200 }, price)).toBe(false);
  });

  it('rejects targets out of order', () => {
    expect(isPlaybookValid({ ...good, target1: 990 }, price)).toBe(false);
    expect(isPlaybookValid({ ...good, target2: 1050 }, price)).toBe(false);
  });

  it('rejects reward that does not exceed risk', () => {
    expect(isPlaybookValid({ ...good, stopLoss: 900, target1: 1100, target2: 1200 }, price)).toBe(false);
  });

  it('rejects an entry more than 8% away from the live price', () => {
    expect(isPlaybookValid({ entry: 1100, stopLoss: 950, target1: 1400, target2: 1500 }, price)).toBe(false);
  });

  it('rejects missing stop / target and unusable prices', () => {
    expect(isPlaybookValid({ ...good, stopLoss: undefined }, price)).toBe(false);
    expect(isPlaybookValid({ ...good, target1: 'TBD' }, price)).toBe(false);
    expect(isPlaybookValid(good, 0)).toBe(false);
    expect(isPlaybookValid(null, price)).toBe(false);
  });

  it('validates free-text levels from the AI report', () => {
    expect(isPlaybookValid({
      entry: 'Market Entry at Rs. 1,000',
      stopLoss: 'Hard stop at ₹950.00 (close below)',
      target1: 'Target 1: 1,080',
      target2: 'Target 2: 1,150',
    }, price)).toBe(true);
  });
});
