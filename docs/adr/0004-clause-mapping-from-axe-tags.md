# 4. WCAG / EN 301 549 clause mapping from axe tags

Date: 2026-08-28

## Status

Accepted

## Context

The report so far names each finding only by its axe `ruleId` (`color-contrast`,
`image-alt`). A BFSG / EN 301 549 report has to say which clause of the standard
a finding breaches — that citation is the compliance value the tool exists to
produce. Something has to turn `color-contrast` into "WCAG SC 1.4.3 / EN 301 549
clause 9.1.4.3".

Two ways to get there:

1. **Hand-author a table** `ruleId → clauses` in this repo.
2. **Read it from axe-core.** Every rule's metadata already carries a `tags`
   array, and the tags encode the mapping: `color-contrast` is tagged
   `wcag143` (WCAG SC 1.4.3) and `EN-9.1.4.3` (EN 301 549 clause 9.1.4.3);
   `wcag2aa` marks the conformance level. Verified against `axe-core@4.13.0`:
   69 rules carry an `EN-301-549` tag, and every rule in the scanner's default
   rule set that maps to a success criterion carries a `wcag<digits>` tag for it.

## Decision

**Read the mapping from the rule tags.** A hand-authored table is a second
source of truth for something axe already states, drifts on every axe upgrade,
and is exactly the kind of transcription that ships wrong. The scan layer now
carries each finding's `tags` verbatim (`ScanFinding.tags`), and a pure
function `clausesFor(tags)` in `src/report/clauses.ts` derives:

- **WCAG success criteria** from `^wcag(\d)(\d)(\d+)$` — first two digits are
  the principle and guideline, the rest is the criterion: `wcag143` → `1.4.3`,
  `wcag1410` → `1.4.10`. Level tags (`wcag2a`, `wcag2aa`, `wcag21aa`) keep
  letters after `wcag` and never match.
- **EN 301 549 clauses** from `^EN-(\d+(?:\.\d+)+)$`: `EN-9.1.4.3` → `9.1.4.3`.
  The bare `EN-301-549` marker uses hyphens, not dots, so it is skipped — it
  says a rule maps to the standard, not to which clause.

Everything else — `cat.*`, `ACT`, `TTv5`, `section508*`, `RGAA*`,
`best-practice`, `experimental` — is ignored. Results are deduped and sorted
numerically (`1.4.10` after `1.4.3`).

**Where clauses live in the report.** `buildReport` attaches
`clauses: { wcagSc, en301549 }` to every finding (violations and incomplete
alike), and `summary` gains `breachedSuccessCriteria` and
`breachedEn301549Clauses` — the distinct clauses across all *violations*.
Incomplete results are excluded from that rollup: they are unconfirmed, and a
rollup is a statement that the site breaches these clauses. The report's
`pages` are therefore no longer the scan pages verbatim; the findings inside
are enriched, the failure entries pass through unchanged.

**BFSG.** The BFSG names no clauses of its own for web content. It grants a
presumption of conformity (BFSG § 3 (1), § 4) to anything meeting the
harmonised standard, and for ICT that standard is EN 301 549, whose Chapter 9
("Web") is WCAG 2.1 level A/AA. So the EN 301 549 clauses this mapping emits
*are* the BFSG-relevant citations; there is no separate BFSG layer to model,
and inventing paragraph numbers for one would be worse than nothing. The legal
chain (BFSG § 3/§ 4 → EN 301 549 § 9 → WCAG 2.1) is documentation, recorded
here and in the README, not report data.

## Consequences

- `schemaVersion` stays `1`: `tags` on findings, `clauses` on findings, and the
  two `summary` arrays are all additive, and nothing consumes a published
  report yet. As ADR 0003 already noted, the version starts mattering at the
  first release — that release freezes this shape.
- The mapping tracks axe-core. An axe upgrade that renames a tag or corrects a
  rule's criteria changes the scanner's output with no code change here. The
  golden e2e test (`src/scan/scan.e2e.test.ts`) pins the clauses for the five
  fixture rules against `fixtures/SITE_TRUTH.md`, so such a change fails CI and
  gets reviewed rather than shipping silently.
- A rule that carries no `wcag<digits>` / `EN-` tag (a `best-practice` rule)
  contributes an empty `clauses` and nothing to the rollup. With the default
  WCAG rule set none such fire, but a custom `wcagTags` could pull one in; the
  finding still appears in the report, just without a citation.
- `clausesFor` is independent of axe at runtime — it takes a `string[]`. Tests
  feed it the real recorded tag arrays rather than calling into axe.
