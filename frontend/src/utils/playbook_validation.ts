/**
 * Validation for AI-generated trade playbooks (entry / stop loss / targets).
 *
 * The AI report returns these levels as free text ("Hard stop at ₹2,450.00
 * (close below)"), so they're parsed here before being checked against the
 * trade-setup invariant. A playbook that fails validation must never reach
 * the user - callers fall back to a deterministic setup instead.
 */

export interface PlaybookLevels {
  entry?: unknown;
  stopLoss?: unknown;
  target1?: unknown;
  target2?: unknown;
}

// How far (either side) a suggested entry may sit from the live price.
export const MAX_ENTRY_DEVIATION = 0.08;

/**
 * Extracts a price from a free-text level. Strips currency markers and
 * "Target 1"-style labels first so their characters can't bleed into the
 * number ("Rs. 2,450" must not parse as 0.245, "Target 1: 2500" not as 12500).
 */
export function parseNumericPrice(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string') return null;

  const cleaned = value
    .replace(/₹|\bINR\b|\bRs\b\.?/gi, ' ')
    .replace(/\b(?:target|tgt|t)\s*[-#]?\s*[12]\b/gi, ' ');

  const match = cleaned.match(/\d[\d,]*(?:\.\d+)?|\.\d+/);
  if (!match) return null;

  const num = parseFloat(match[0].replace(/,/g, ''));
  return Number.isFinite(num) ? num : null;
}

/**
 * True when the playbook satisfies: Stop Loss < Current Price, Stop Loss <
 * Entry < Target 1 < Target 2 (if given), entry within MAX_ENTRY_DEVIATION of
 * the live price, and Reward > Risk (R:R > 1).
 */
export function isPlaybookValid(pb: PlaybookLevels | null | undefined, currentPrice: number): boolean {
  if (!pb || !(currentPrice > 0)) return false;

  const entry = parseNumericPrice(pb.entry) ?? currentPrice;
  const stopLoss = parseNumericPrice(pb.stopLoss);
  const target1 = parseNumericPrice(pb.target1);
  const target2 = parseNumericPrice(pb.target2);
  if (!stopLoss || !target1) return false;

  const isStopValid = stopLoss < entry && stopLoss < currentPrice;
  const isTargetValid = entry < target1 && (!target2 || target1 < target2);
  const isEntryNearPrice = Math.abs(entry - currentPrice) / currentPrice <= MAX_ENTRY_DEVIATION;
  const risk = entry - stopLoss;
  const reward = target1 - entry;
  const isRewardValid = risk > 0 && reward > risk;

  return isStopValid && isTargetValid && isEntryNearPrice && isRewardValid;
}
