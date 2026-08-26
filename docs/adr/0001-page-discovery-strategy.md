# 1. Page discovery strategy

Date: 2026-08-26

## Status

Accepted

## Context

The scanner is given a single `baseUrl`. Before it can run axe-core it needs the
list of pages to visit. Two sources are available for a typical site:

- **`sitemap.xml`** (optionally a sitemap index pointing at sub-sitemaps) — an
  explicit, machine-readable list published by the site owner.
- **Crawling** — following same-origin `<a href>` links breadth-first from
  `baseUrl`.

Both were already implemented as standalone modules (`discoverFromSitemap`,
`crawlSite`) but nothing combined them, and the CLI scanned only `[baseUrl]`,
ignoring `maxPages` and `excludePaths`.

Constraints:

- A compliance report should reflect the whole site, not just the home page.
- Runs must stay bounded (`maxPages`) and polite (per-host rate limiting already
  exists in the scan engine; `robots.txt` is respected by the crawler).
- Output must be deterministic so the golden e2e tests stay stable.

## Decision

Add a thin orchestrator, `discoverSite`, that picks one strategy:

1. **Sitemap first.** Fetch `/sitemap.xml`, follow an index to its
   sub-sitemaps, collect same-origin `<loc>` entries. The sitemap is the
   owner's own declaration of what exists, so it is preferred whenever present.
2. **Crawl as fallback.** If the root sitemap is missing or unparseable
   (`SitemapError`), fall back to `crawlSite` from `baseUrl`.

Shared rules across both strategies:

- `excludePaths` globs and the non-page-asset filter (`.pdf`, `.jpg`, …) are
  applied identically. `discoverFromSitemap` gained an `excludePaths` option in
  this change so the two paths cannot diverge.
- The result is capped at `maxPages` and stays in discovery order.

Where they deliberately differ:

- **`robots.txt`** is obeyed on the crawl path only. A URL the owner placed in
  their own sitemap is taken as intended for scanning; `robots.txt` is a
  crawl-politeness directive, and on the sitemap path there is no crawl.
- **`baseUrl` guarantee**: on the sitemap path `baseUrl` is prepended if the
  sitemap did not list it, so the home page is always covered. The crawl path
  already starts from `baseUrl` and needs no fixup — including the case where a
  `robots.txt`-disallowed home page correctly yields zero pages.

The CLI now calls `discoverSite` and exits `3` when it returns no pages
(previously `3` meant only "a page failed to load").

## Consequences

- The `discovery/` modules are now reachable from the CLI; `maxPages` and
  `excludePaths` take effect for the first time.
- A site with a stale or partial sitemap is scanned per that sitemap, not
  crawled to fill the gaps. Merging both sources is possible later but adds
  non-determinism and crawl cost; deferred until there is a real need.
- URL normalisation still differs slightly between the two paths
  (`crawlSite` strips fragments and normalises; `discoverFromSitemap` emits
  `<loc>` verbatim). `discoverSite` compares normalised forms when deciding
  whether to prepend `baseUrl`, but a fuller normalisation pass is left for a
  follow-up.
- `robots.txt` being ignored on the sitemap path is a conscious trade-off; if
  it proves surprising it can be revisited without changing the module
  boundaries.
