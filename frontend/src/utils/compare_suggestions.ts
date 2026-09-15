/**
 * Buy/Avoid and better-alternative suggestions for the Compare page. Pure
 * ranking over real computed scores - no generated text - kept out of the
 * component so the rules can be unit tested.
 */

export interface ScoredSlot {
  ticker: string;
  report: {
    scores: { overall_score: number };
    market_context?: { sector?: { sector_name?: string } };
  } | null;
}

export interface ScoredOpportunity {
  ticker: string;
  sector: string;
  overall_score: number;
}

// Sector labels too generic to base a "same sector" suggestion on.
const NON_SECTORS = new Set(['General Market', 'UNKNOWN']);

const score = (slot: ScoredSlot) => slot.report!.scores.overall_score;
const normalizeTicker = (ticker: string) => ticker.toUpperCase().trim();

/**
 * Highest- and lowest-scoring loaded stocks. Needs at least two stocks, and
 * returns no picks when they're all tied - calling one of several
 * identically-scored stocks the one to "avoid" would be arbitrary.
 */
export function pickBuyAvoid<T extends ScoredSlot>(slots: T[]): { buyPick: T | null; avoidPick: T | null } {
  const ranked = slots.filter(s => s.report).sort((a, b) => score(b) - score(a));
  if (ranked.length < 2) return { buyPick: null, avoidPick: null };

  const buyPick = ranked[0];
  const avoidPick = ranked[ranked.length - 1];
  if (score(buyPick) === score(avoidPick)) return { buyPick: null, avoidPick: null };
  return { buyPick, avoidPick };
}

/**
 * For each real sector among the compared stocks, the best-scoring stock in
 * that sector from the opportunities scan that isn't already being compared -
 * only when it strictly beats every compared stock in that sector.
 */
export function findSectorAlternatives<T extends ScoredSlot, O extends ScoredOpportunity>(slots: T[], opportunities: O[]) {
  const loaded = slots.filter(s => s.report);
  const comparedTickers = new Set(loaded.map(s => normalizeTicker(s.ticker)));

  const sectorGroups = new Map<string, T[]>();
  loaded.forEach(s => {
    const sectorName = s.report!.market_context?.sector?.sector_name;
    if (!sectorName || NON_SECTORS.has(sectorName)) return;
    if (!sectorGroups.has(sectorName)) sectorGroups.set(sectorName, []);
    sectorGroups.get(sectorName)!.push(s);
  });

  return Array.from(sectorGroups.entries()).map(([sectorName, group]) => {
    const bestInGroup = group.reduce((a, b) => (score(a) >= score(b) ? a : b));
    const alt = opportunities
      .filter(o => o.sector === sectorName && !comparedTickers.has(normalizeTicker(o.ticker)))
      .sort((a, b) => b.overall_score - a.overall_score)[0];
    if (!alt || alt.overall_score <= score(bestInGroup)) return null;
    return { sectorName, comparedTickers: group.map(g => g.ticker), bestInGroup, alt };
  }).filter((x): x is NonNullable<typeof x> => x !== null);
}
