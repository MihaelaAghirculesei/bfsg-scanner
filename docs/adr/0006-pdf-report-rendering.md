# 6. PDF report rendering

Date: 2026-08-28

## Status

Accepted

## Context

`bfsg.config.yaml` has always advertised PDF output alongside JSON and HTML.
JSON landed in ADR 0002 and the localised HTML in ADR 0005; the HTML is
already a self-contained document with inline CSS, no JavaScript, and a
`@media print` block written for this step. What is left is turning that
HTML into a PDF a non-engineer can file as the compliance record.

## Decision

**Print the HTML with headless Chromium** (`page.setContent(html)` then
`page.pdf()`), in a new `renderPdfReport(html, browser)` in the report
module. Playwright and Chromium are already the scanner's engine, so this
adds no dependency and no system binary. Chromium is the only engine
Playwright can print with; that constraint is already accepted everywhere
else in the tool. The HTML needs no server and no network — it carries its
own styles — so `setContent` is enough.

**One browser per run, owned by `run.ts`.** Until now `scan` launched and
closed its own Chromium. `run` now launches one Chromium (unless a browser
is injected, as tests do), passes it to `scan`, reuses it to print the PDF,
and closes it in a `finally`. `run` closes only a browser it launched
itself — the same contract `scan` keeps for an injected one. This replaces
one launch with one launch; it does not add a second.

**The PDF is written where the JSON and HTML are** — before the
partial-failure check, so a run that exits `3` for unreachable pages still
leaves all three artifacts. A failure inside `renderPdfReport` propagates
like any other write failure; the JSON and HTML are already on disk by
then, and there is no reason to treat a broken PDF render as recoverable
when a broken HTML write is not.

**A4, backgrounds on, ~15 mm margins.** Fixed, not configurable: the report
is a document to read and file, not a layout to tune.

## Consequences

- `run` now has a browser lifecycle. The early exits for bad config (`2`)
  and empty discovery (`3`) still return before any launch. The scan and
  report body moved into a `scanAndReport` helper so the `try/finally` that
  owns the browser stays readable.
- `writeArtifact` now takes `string | Uint8Array`; `writeReport` and
  `writeHtmlReport` are unchanged in behaviour.
- PDF size tracks HTML size, which `maxPages` bounds. A large scan produces
  a large PDF; that is the same trade-off ADR 0002 made for the JSON.
- `renderPdfReport` needs a real Chromium to test, so its test launches one
  like the scan tests do — it is not a pure unit like `renderHtmlReport`.
- Still not configurable: page size, margins, and whether the PDF is
  written at all. If a user only wants JSON, that is a `--format` flag for
  later, not part of adding the format the config already promises.
