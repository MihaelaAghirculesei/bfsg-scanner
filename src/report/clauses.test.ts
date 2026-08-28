import { describe, expect, it } from 'vitest';
import { clausesFor, compareDotted } from './clauses.js';

// The real axe-core@4.13.0 tag arrays for the five rules the golden fixture
// site triggers (see fixtures/SITE_TRUTH.md). If an axe upgrade changes
// these, this test and that file must move together.
const REAL_TAGS = {
  'color-contrast': [
    'cat.color',
    'wcag2aa',
    'wcag143',
    'TTv5',
    'TT13.c',
    'EN-301-549',
    'EN-9.1.4.3',
    'ACT',
    'RGAAv4',
    'RGAA-3.2.1',
  ],
  'image-alt': [
    'cat.text-alternatives',
    'wcag2a',
    'wcag111',
    'section508',
    'section508.22.a',
    'TTv5',
    'TT7.a',
    'TT7.b',
    'EN-301-549',
    'EN-9.1.1.1',
    'ACT',
    'RGAAv4',
    'RGAA-1.1.1',
  ],
  label: [
    'cat.forms',
    'wcag2a',
    'wcag412',
    'section508',
    'section508.22.n',
    'TTv5',
    'TT5.c',
    'EN-301-549',
    'EN-9.4.1.2',
    'ACT',
    'RGAAv4',
    'RGAA-11.1.1',
  ],
  'html-has-lang': [
    'cat.language',
    'wcag2a',
    'wcag311',
    'TTv5',
    'TT11.a',
    'EN-301-549',
    'EN-9.3.1.1',
    'ACT',
    'RGAAv4',
    'RGAA-8.3.1',
  ],
  'link-name': [
    'cat.name-role-value',
    'wcag2a',
    'wcag244',
    'wcag412',
    'section508',
    'section508.22.a',
    'TTv5',
    'TT6.a',
    'EN-301-549',
    'EN-9.2.4.4',
    'EN-9.4.1.2',
    'ACT',
    'RGAAv4',
    'RGAA-6.2.1',
  ],
} satisfies Record<string, readonly string[]>;

describe('clausesFor', () => {
  it('maps each fixture rule to its WCAG success criteria and EN 301 549 clauses', () => {
    expect(clausesFor(REAL_TAGS['color-contrast'])).toEqual({
      wcagSc: ['1.4.3'],
      en301549: ['9.1.4.3'],
    });
    expect(clausesFor(REAL_TAGS['image-alt'])).toEqual({
      wcagSc: ['1.1.1'],
      en301549: ['9.1.1.1'],
    });
    expect(clausesFor(REAL_TAGS.label)).toEqual({
      wcagSc: ['4.1.2'],
      en301549: ['9.4.1.2'],
    });
    expect(clausesFor(REAL_TAGS['html-has-lang'])).toEqual({
      wcagSc: ['3.1.1'],
      en301549: ['9.3.1.1'],
    });
  });

  it('keeps every criterion when a rule spans more than one', () => {
    expect(clausesFor(REAL_TAGS['link-name'])).toEqual({
      wcagSc: ['2.4.4', '4.1.2'],
      en301549: ['9.2.4.4', '9.4.1.2'],
    });
  });

  it('ignores level, category, ruleset and bare-standard markers', () => {
    expect(
      clausesFor([
        'cat.color',
        'wcag2aa',
        'wcag21aa',
        'wcag22aa',
        'best-practice',
        'experimental',
        'ACT',
        'TTv5',
        'section508',
        'section508.22.a',
        'RGAAv4',
        'RGAA-3.2.1',
        'EN-301-549',
      ]),
    ).toEqual({ wcagSc: [], en301549: [] });
  });

  it('parses a two-digit criterion number without splitting it', () => {
    // wcag1410 is SC 1.4.10 (Reflow), not 1.4.1 with a stray 0.
    expect(clausesFor(['wcag1410', 'EN-9.1.4.10'])).toEqual({
      wcagSc: ['1.4.10'],
      en301549: ['9.1.4.10'],
    });
  });

  it('orders criteria numerically, not lexically', () => {
    expect(clausesFor(['wcag1410', 'wcag143', 'wcag111']).wcagSc).toEqual([
      '1.1.1',
      '1.4.3',
      '1.4.10',
    ]);
  });

  it('dedupes a criterion that appears twice', () => {
    expect(clausesFor(['wcag143', 'wcag143']).wcagSc).toEqual(['1.4.3']);
  });

  it('returns empty arrays for an empty tag list', () => {
    expect(clausesFor([])).toEqual({ wcagSc: [], en301549: [] });
  });
});

describe('compareDotted', () => {
  it('sorts by numeric value of each segment', () => {
    expect(['9.1.4.10', '9.1.4.3', '9.2.1.1'].sort(compareDotted)).toEqual([
      '9.1.4.3',
      '9.1.4.10',
      '9.2.1.1',
    ]);
  });
});
