# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project
aims to follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html)
from its first release onward.

## [Unreleased]

Everything below is on `main` but not yet cut as a versioned release.

### Added

- Site discovery: `sitemap.xml` first, then a `robots.txt`-respecting
  breadth-first crawl, bounded by `maxPages` and `excludePaths`.
- Scan engine: axe-core in Chromium via Playwright, with a concurrency pool,
  a per-host rate limit, retries, and an identifiable User-Agent.
- `report.json` — versioned, self-describing (`schemaVersion: 1`), with a
  shipped JSON Schema at `schema/report.v1.json`.
- Clause mapping: every finding is tagged with its WCAG success criteria and
  EN 301 549 clauses, read from axe-core rule metadata; the report rolls up
  the distinct breached clauses.
- `failOn` severity threshold driving the process exit code (`0`/`1`), plus
  `2` for bad configuration and `3` for an incomplete scan.
- Localised `report.html` (German or English) — a self-contained page — and
  `report.pdf` (the HTML printed to A4).
- CLI: a positional `url` argument for a one-page scan without a config
  file, `--config`, `--fail-on`, `--report-language`, `--output-dir`,
  `--format`, `--help`, `--version`.
- `reportFormats` config key / `--format` flag to choose which report files
  are written.
- Distributable package: a `bfsg-scanner` bin and a `dist` build that
  excludes tests.

[Unreleased]: https://github.com/MihaelaAghirculesei/bfsg-scanner/commits/main
