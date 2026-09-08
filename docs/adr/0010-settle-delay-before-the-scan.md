# 10. A settle delay before the scan

Date: 2026-09-08

## Status

Accepted

## Context

`scanPage` navigates with `waitUntil: 'load'` and runs axe immediately
after. `load` fires when the initial document and its subresources have
loaded — but not after client-side work that follows: a single-page app
hydrating, a framework upgrading its components, a page fetching its
translations and swapping them into the DOM.

Run against a statically-rendered site that localises in the browser, the
scan sees the pre-hydration shell: empty translated strings, controls not
yet wired up. axe then reports contentless links and unlabelled controls
that a real user never meets. Field use turned this up — a production
portfolio flagged an "empty" call-to-action that is fully populated a
moment after `load`.

`waitUntil: 'networkidle'` is the obvious lever but a poor default: the
Playwright docs discourage it, and a page with analytics beacons or
long-polling never goes idle, so every scan would pay the full navigation
timeout.

## Decision

Add **`settleMs`** — a fixed pause between `load` and the axe run.

- Config key `settleMs`, CLI flag `--settle <ms>`, `ScanOptions.settleMs`.
- **Default `0`.** A server-rendered page is complete at `load`; nothing
  changes for it, and no existing scan slows down or shifts its result
  without the operator asking.
- Bounded 0–60000 by `configSchema`. A non-numeric `--settle` is a
  configuration error (exit 2), like every other bad flag.
- Applied per attempt, so a retry waits again.

The knob is deliberately dumb — a flat wait, not a heuristic. It is
predictable, trivial to reason about, and the operator sets it against a
site they know. `networkidle` and friends can be layered on later if a
real need appears; this covers the reported case without a smart default
that could regress a well-behaved site.

## Consequences

- Scanning a client-rendered site now means picking a value: enough for
  the slowest hydrate/fetch on that site, added to every page's scan time.
  The README's configuration section says so.
- `settleMs` sits alongside `maxPages` as a config-only tuning field with
  a matching CLI override; `run` passes `config.settleMs` into `scan`.
- The report envelope and `schemaVersion` are untouched — this changes
  *when* the DOM is read, not the shape of what is written.
- A page that renders after `load` but sooner than `settleMs` just waits
  out the remainder; the delay is a ceiling on staleness, not a target.
