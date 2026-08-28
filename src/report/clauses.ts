/**
 * The standards clauses an axe-core finding breaches, read from the rule's
 * own tags.
 *
 * axe-core already carries the mapping: every rule's `tags` array names the
 * WCAG success criteria it checks (`wcag143` -> SC 1.4.3) and the matching
 * EN 301 549 clauses (`EN-9.1.4.3`). The scanner reads that mapping rather
 * than maintaining a hand-authored table (see ADR 0004). The German BFSG
 * adds no per-rule detail of its own: for web content it grants a
 * presumption of conformity (BFSG SS 3(1), SS 4) to anything meeting the
 * harmonised standard EN 301 549, whose Chapter 9 ("Web") is WCAG 2.1
 * level A/AA. So the EN 301 549 clauses below are the BFSG-relevant
 * citations.
 */
export interface Clauses {
  /** WCAG success criteria, dotted (`1.4.3`), numerically sorted, deduped. */
  readonly wcagSc: readonly string[];
  /** EN 301 549 clauses, dotted (`9.1.4.3`), numerically sorted, deduped. */
  readonly en301549: readonly string[];
}

/**
 * A WCAG SC tag: `wcag` followed by the digits of the criterion number with
 * the dots removed — `wcag143` is SC 1.4.3, `wcag1410` is SC 1.4.10. The
 * first two digits are always the principle and guideline; whatever follows
 * is the criterion. Level tags (`wcag2a`, `wcag2aa`, `wcag21aa`) carry
 * letters after `wcag` and so never match.
 */
const WCAG_SC_TAG = /^wcag(\d)(\d)(\d+)$/;

/**
 * An EN 301 549 clause tag: `EN-` followed by a dotted clause number
 * (`EN-9.1.4.3`). The bare `EN-301-549` marker uses hyphens, not dots, so
 * it is skipped — it says only that the rule maps to the standard somehow,
 * not to which clause.
 */
const EN_301_549_TAG = /^EN-(\d+(?:\.\d+)+)$/;

/**
 * Derives the WCAG and EN 301 549 clauses a finding breaches from its axe
 * rule tags. Pure. Unrecognised tags — `cat.*`, `ACT`, `TTv5`, `section508*`,
 * `RGAA*`, `best-practice`, `experimental`, the bare `EN-301-549` marker —
 * are ignored.
 */
export function clausesFor(tags: readonly string[]): Clauses {
  const wcagSc = new Set<string>();
  const en301549 = new Set<string>();

  for (const tag of tags) {
    const wcag = WCAG_SC_TAG.exec(tag);
    if (wcag !== null) {
      wcagSc.add(`${wcag[1]}.${wcag[2]}.${wcag[3]}`);
      continue;
    }
    const enClause = EN_301_549_TAG.exec(tag)?.[1];
    if (enClause !== undefined) {
      en301549.add(enClause);
    }
  }

  return {
    wcagSc: [...wcagSc].sort(compareDotted),
    en301549: [...en301549].sort(compareDotted),
  };
}

/**
 * Orders dotted-number strings segment by segment, numerically, so `1.4.10`
 * sorts after `1.4.3` rather than before it as a plain string compare would.
 * Exported for the report layer's clause rollup, which sorts the same shape.
 */
export function compareDotted(a: string, b: string): number {
  const as = a.split('.');
  const bs = b.split('.');
  for (let i = 0; i < Math.max(as.length, bs.length); i += 1) {
    const diff = Number(as[i] ?? 0) - Number(bs[i] ?? 0);
    if (diff !== 0) {
      return diff;
    }
  }
  return 0;
}
