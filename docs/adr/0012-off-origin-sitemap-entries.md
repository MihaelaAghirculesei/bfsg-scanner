# 12. Off-origin sitemap entries

Date: 2026-10-17

## Status

Accepted

## Context

ADR 0001 collects only same-origin `<loc>` entries from the sitemap and
falls back to crawling only when the root sitemap is missing or unparseable.
Dropping off-origin entries was silent.

The common way to hit it is a local or staging build whose `sitemap.xml`
was generated for production: every entry is off-origin, the sitemap still
parses, so no crawl runs, `baseUrl` is prepended, and the run scans the home
page alone. With a clean home page that exits `0` — a CI gate reporting a
clean site it never looked at (#58).

## Decision

**Warn.** `discoverFromSitemap` reports the distinct off-origin entries it
dropped; the CLI prints one line with the count, the origins involved, and
a hint to set `sitemapOrigin`.

**A sitemap with no usable page falls back to the crawl.** When the sitemap
yields no scannable page on `baseUrl`'s origin — all off-origin, all
excluded, or simply empty — `discoverSite` treats it like a missing sitemap
and crawls from `baseUrl`, with a warning that it did. A sitemap that leaves
at least one page is used as before: a partial sitemap is still the owner's
own list (ADR 0001). If the crawl finds nothing either, discovery returns no
pages and the run exits `3`, the existing "no pages discovered" code.

**`sitemapOrigin` rewrites one origin onto `baseUrl`'s.** A bare origin, in
config or as `--sitemap-origin`. Page entries and sub-sitemap URLs on that
origin get `baseUrl`'s origin, path, query and fragment kept, so a staging
build is scanned page for page against the production sitemap, and the
build's own copies of sub-sitemaps are read. Entries on any third origin
are still dropped with the warning. Deduplication runs after the rewrite.

It gets a CLI flag, unlike `maxPages` or `excludePaths` (ADR 0007): the case
it serves — a one-off scan of `http://localhost:…` in a build job — is the
one a positional URL exists for.

## Consequences

- No exit code changes meaning. A run that used to pass on the home page
  alone now either scans what the crawl reaches, or exits `3`.
- A sitemap that lists nothing scannable now costs a crawl. That is the
  same cost as a site with no sitemap.
- Only the origin is rewritten, never a path prefix. A staging copy served
  under a sub-path (`https://staging/app/` for `https://prod/`) is not
  covered; that would need a prefix mapping, deferred until asked for.
