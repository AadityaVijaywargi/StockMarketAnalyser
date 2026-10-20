import { describe, expect, it } from 'vitest';
import { formatSignedRupees, orderProblem, parseOptionalPrice, pnlClass, reasonLabel } from './paper_format';

describe('formatSignedRupees', () => {
  it('always shows the sign', () => {
    expect(formatSignedRupees(1234.5)).toBe('+₹1,234.50');
    expect(formatSignedRupees(-1234.5)).toBe('-₹1,234.50');
    expect(formatSignedRupees(0)).toBe('₹0.00');
    expect(formatSignedRupees(null)).toBe('--');
  });
});

describe('pnlClass', () => {
  it('colours by sign', () => {
    expect(pnlClass(5)).toContain('emerald');
    expect(pnlClass(-5)).toContain('rose');
    expect(pnlClass(0)).toContain('slate');
  });
});

describe('reasonLabel', () => {
  it('describes every reason', () => {
    expect(reasonLabel('TARGET', 'SELL')).toBe('Target hit');
    expect(reasonLabel('STOP', 'SELL')).toBe('Stop-loss hit');
    expect(reasonLabel('BOT_SIGNAL', 'BUY')).toBe('Bot: BUY signal');
    expect(reasonLabel('MANUAL', 'SELL')).toBe('Manual sell');
  });
});

describe('parseOptionalPrice', () => {
  it('treats blank as unset and junk as invalid', () => {
    expect(parseOptionalPrice('  ')).toBeNull();
    expect(parseOptionalPrice('101.5')).toBe(101.5);
    expect(parseOptionalPrice('-3')).toBeNaN();
    expect(parseOptionalPrice('abc')).toBeNaN();
  });
});

describe('orderProblem', () => {
  const base = { side: 'BUY' as const, quantity: 10, price: 100, target: null, stop: null, cash: 5000, held: 0 };

  it('accepts a valid buy', () => {
    expect(orderProblem(base)).toBeNull();
    expect(orderProblem({ ...base, target: 110, stop: 95 })).toBeNull();
  });

  it('flags bad quantity, levels and cash', () => {
    expect(orderProblem({ ...base, quantity: 0 })).toMatch(/whole number/);
    expect(orderProblem({ ...base, quantity: 2.5 })).toMatch(/whole number/);
    expect(orderProblem({ ...base, target: 90 })).toMatch(/Target/);
    expect(orderProblem({ ...base, stop: 100 })).toMatch(/Stop-loss/);
    expect(orderProblem({ ...base, target: NaN })).toMatch(/Target/);
    expect(orderProblem({ ...base, quantity: 51 })).toMatch(/cash/);
  });

  it('checks sells against holdings only', () => {
    const sell = { ...base, side: 'SELL' as const, cash: 0 };
    expect(orderProblem({ ...sell, held: 0 })).toMatch(/don't hold/);
    expect(orderProblem({ ...sell, held: 5 })).toMatch(/only hold 5/);
    expect(orderProblem({ ...sell, held: 10 })).toBeNull();
  });

  it('skips price checks when no price is known yet', () => {
    expect(orderProblem({ ...base, price: null, quantity: 1_000_000 })).toBeNull();
  });
});
