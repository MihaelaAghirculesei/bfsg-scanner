import type { ImpactValue } from 'axe-core';
import type { ReportImpactCounts } from './types.js';

/**
 * axe-core impacts from least to most severe. Index position is the rank;
 * a finding meets a threshold when its rank is at or above the threshold's.
 */
export const IMPACT_RANK = ['minor', 'moderate', 'serious', 'critical'] as const;

export type ImpactThreshold = (typeof IMPACT_RANK)[number];

/**
 * True when `impact` is at least as severe as `threshold`.
 *
 * A `null` impact (axe leaves it unset) is deliberately never a match: it
 * cannot be ranked, so it can neither be trusted to clear a threshold nor
 * be assumed to breach one. Such findings are counted separately in the
 * report's `unknown` bucket and surfaced by the CLI, so they are never
 * silently dropped.
 */
export function meetsThreshold(impact: ImpactValue, threshold: ImpactThreshold): boolean {
  if (impact === null) {
    return false;
  }
  // -1 also covers an impact string a future axe version might add: an
  // unrankable value is treated exactly like null rather than guessed at.
  const impactRank = IMPACT_RANK.indexOf(impact as ImpactThreshold);
  return impactRank !== -1 && impactRank >= IMPACT_RANK.indexOf(threshold);
}

/** Total violated rules whose impact is at or above `threshold`. */
export function countAtOrAbove(counts: ReportImpactCounts, threshold: ImpactThreshold): number {
  return IMPACT_RANK.filter((impact) => meetsThreshold(impact, threshold)).reduce(
    (sum, impact) => sum + counts[impact],
    0,
  );
}
