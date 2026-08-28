import type { ImpactValue } from 'axe-core';
import { describe, expect, it } from 'vitest';
import type { ReportImpactCounts } from './types.js';
import { countAtOrAbove, IMPACT_RANK, meetsThreshold } from './verdict.js';

function counts(overrides: Partial<ReportImpactCounts> = {}): ReportImpactCounts {
  return { critical: 0, serious: 0, moderate: 0, minor: 0, unknown: 0, ...overrides };
}

describe('meetsThreshold', () => {
  it('matches an impact equal to the threshold', () => {
    for (const impact of IMPACT_RANK) {
      expect(meetsThreshold(impact, impact), impact).toBe(true);
    }
  });

  it('matches an impact more severe than the threshold', () => {
    expect(meetsThreshold('critical', 'serious')).toBe(true);
    expect(meetsThreshold('serious', 'minor')).toBe(true);
  });

  it('rejects an impact less severe than the threshold', () => {
    expect(meetsThreshold('serious', 'critical')).toBe(false);
    expect(meetsThreshold('minor', 'moderate')).toBe(false);
  });

  it('never matches a null impact, whatever the threshold', () => {
    for (const threshold of IMPACT_RANK) {
      expect(meetsThreshold(null, threshold), threshold).toBe(false);
    }
  });

  it('treats an impact axe might add in future like null rather than guessing', () => {
    const unrecognised = 'catastrophic' as unknown as ImpactValue;

    expect(meetsThreshold(unrecognised, 'minor')).toBe(false);
  });
});

describe('countAtOrAbove', () => {
  it('sums only the buckets at or above the threshold', () => {
    const all = counts({ critical: 1, serious: 2, moderate: 4, minor: 8 });

    expect(countAtOrAbove(all, 'critical')).toBe(1);
    expect(countAtOrAbove(all, 'serious')).toBe(3);
    expect(countAtOrAbove(all, 'moderate')).toBe(7);
    expect(countAtOrAbove(all, 'minor')).toBe(15);
  });

  it('excludes the unknown bucket at every threshold', () => {
    const onlyUnknown = counts({ unknown: 3 });

    for (const threshold of IMPACT_RANK) {
      expect(countAtOrAbove(onlyUnknown, threshold), threshold).toBe(0);
    }
  });

  it('returns 0 when nothing was found', () => {
    expect(countAtOrAbove(counts(), 'minor')).toBe(0);
  });
});
