# 3. failOn threshold and exit codes

Date: 2026-08-27

## Status

Accepted

## Context

`failOn` (`critical | serious | moderate | minor`, default `serious`) has
been in the config since ADR 0002's predecessor, and ADR 0002 carried it into
the report — but nothing acted on it. Every completed scan exited `0`, so no
CI job could gate a merge on accessibility, which is the whole point of a
compliance scanner in a pipeline.

The existing exit codes were `0` (completed), `2` (bad config), `3` (nothing
discovered, or a page failed to scan).

## Decision

**Severity ranking.** axe-core impacts rank `minor < moderate < serious <
critical`. A violation meets the threshold when its impact is at least as
severe as `failOn`.

**Unranked violations.** A violation whose impact axe left `null` — or one
carrying an impact string a future axe version might introduce — is never
counted toward the threshold. It cannot be ranked, so it can neither be
trusted to clear a threshold nor be assumed to breach one. Guessing in
either direction is worse than saying so: such findings are counted in the
report's `verdict.unrankedViolations`, and the CLI prints a warning naming
them. They are excluded from the pass/fail arithmetic, never from view.

**Verdict scope.** The verdict answers only "did the pages that scanned stay
under the threshold?". A page that failed to load has *unknown* compliance:
it is counted in `summary.pagesFailed` and drives the exit code, but it
cannot flip a verdict in either direction.

**Exit codes.**

| Code | Meaning |
|---|---|
| `0` | scan completed, nothing at or above `failOn` |
| `1` | scan completed, violations at or above `failOn` |
| `2` | invalid or missing configuration |
| `3` | no pages discovered, or a page could not be scanned |

`3` outranks `1`. A run with unreachable pages scanned an incomplete site,
so reporting "no violations found" would be a claim the data cannot support.
The report is written before either check, so partial results and failure
entries survive regardless of which code is returned.

`1` is the conventional "ran fine, found problems" code (`grep`, `eslint`,
`tsc`), which is what a CI gate expects.

## Consequences

- Adding `verdict` to the report is additive, so `schemaVersion` stays `1`:
  nothing consumes a published report yet and no report from an earlier
  build exists in the wild. The version starts mattering at the first
  release.
- `target.failOn` is now the `ImpactThreshold` union rather than a bare
  `string`, so an unrankable threshold cannot reach the report at all.
- The default `failOn: serious` means a `color-contrast` finding (impact
  `serious`) fails a build. That matches the BFSG/EN 301 549 baseline, where
  contrast is a genuine conformance failure rather than an advisory.
- Counting is by **violated rule**, not by node. Ten images missing `alt` on
  one page is one `image-alt` violation. Node-level counts stay available in
  the report for anyone who needs to weigh breadth.
- Not addressed here: per-rule ignores/waivers, and a budget ("fail only
  above N violations"). Both are real needs for a team adopting the scanner
  on an existing site, but neither belongs in the first threshold change.
