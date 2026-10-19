# 13. Default WCAG rule set

Date: 2026-10-19

## Status

Accepted

## Context

axe-core selects rules by tag. A WCAG version and level is one tag, and
each tag holds only the criteria that version added at that level:
`wcag2a` and `wcag2aa` are WCAG 2.0, `wcag21a` and `wcag21aa` are what
WCAG 2.1 added. A WCAG 2.1 AA check needs all four.

The default `wcagTags` were `wcag2a`, `wcag2aa`, `wcag21aa`. No decision
left out `wcag21a`; it was an oversight. Up to axe-core 4.13 it cost
nothing, because the one rule tagged `wcag21a` and not also tagged by the
others, `label-content-name-mismatch` (SC 2.5.3 *Label in Name*), was
`experimental` and did not run. axe-core 4.14, which 0.3.0 ships, enables
it, so a default run that the README and the report call WCAG 2.1 AA
skipped a criterion EN 301 549 clause 9.2.5.3 requires (#65).

## Decision

**The default rule set is the WCAG 2.1 Level A and AA tags, all four:**
`wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`.

That is the level EN 301 549 V3.2.1 chapter 9 references, and with it the
BFSG presumption of conformity (ADR 0004). The default follows the standard,
not the tags that happen to have rules today, so a rule axe-core adds under
any of the four runs without a change here.

Not in the default:

- **`wcag2aaa`**: Level AAA is not required by EN 301 549.
- **`wcag22a` / `wcag22aa`**: WCAG 2.2 is not yet what EN 301 549
  references. A later EN 301 549 that moves to WCAG 2.2 calls for a new
  decision and a minor release.
- **`best-practice`, `experimental`**: not WCAG criteria, so their findings
  could not cite a clause and would blur what a failing gate means.

A config can still narrow the set; `wcagTagSchema` accepts any subset.

## Consequences

- A default run can report findings that 0.3.0 did not, so a CI gate that
  passed on 0.3.0 can fail on the same site. The change ships in a minor
  release with a CHANGELOG note.
- Any later change to the default rule set changes what a gate checks and
  is released the same way: a minor, never a patch.
- The golden fixture site covers SC 2.5.3 (`fixtures/site/label-in-name.html`),
  so dropping `wcag21a` again fails the test suite.
