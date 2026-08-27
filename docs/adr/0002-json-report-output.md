# 2. JSON report output

Date: 2026-08-27

## Status

Accepted

## Context

Discovery (ADR 0001) and the scan engine now produce a full `ScanResult`, but
the CLI only prints a one-line summary — nothing is persisted. A compliance
tool has to leave an artifact: something a CI job can archive, a diff can run
against, and a human or a later HTML/PDF renderer can consume.

`src/index.ts` already declares `SCHEMA_VERSION = 1` for exactly this, and the
config already has `outputDir` (default `reports/`, git-ignored).

## Decision

Add a `report/` module with three pieces:

- **`types.ts`** — the `Report` shape: `schemaVersion`, `generatedAt`, `tool`
  (name/version), `target` (the `baseUrl` / `wcagTags` / `failOn` echoed back
  so a stored report is self-describing), a `summary`, and `pages`.
- **`buildReport(scanResult, target, options?)`** — pure apart from a default
  clock and a one-time `package.json` read, both overridable via `options`
  (`generatedAt`, `tool`) for deterministic tests. Computes the summary:
  pages scanned/failed/with-violations, total violated rules, and rule counts
  bucketed by axe-core impact (`critical|serious|moderate|minor|unknown`,
  where `unknown` is impact `null`).
- **`writeReport(report, outputDir)`** — `mkdir -p`, then write
  `<outputDir>/report.json` as pretty JSON with a trailing newline; returns
  the path.

The CLI calls both after the scan, **before** the partial-failure check, so a
run that exits `3` for unreachable pages still leaves a report — the partial
results and the failure entries are worth keeping.

## Consequences

- `pages` is the scan engine's `PageScanResult[]` verbatim (failures
  included). One source of truth for the result shape; no parallel type
  hierarchy to keep in sync. The trade-off: the on-disk schema is now
  coupled to `scan/types.ts`, so a change there is a `schemaVersion` bump.
- Node HTML and selectors from axe are written in full. That is the actual
  evidence for each violation; `maxPages` bounds the total size.
- One canonical `report.json`, overwritten each run — predictable for CI.
  Timestamped history, and non-JSON renderings (HTML, PDF), are deliberately
  out of scope here.
- `generatedAt` makes the file non-byte-deterministic; that is fine for an
  artifact (it is not a golden fixture) and tests inject a fixed clock.
- `failOn` is carried in the report but not yet acted on — scoring and a
  threshold exit code are the next change.
