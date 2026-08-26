# fixtures/sitemaps — provenance

These are real sitemaps, captured from public, unauthenticated URLs on
2026-08-26 and trimmed for size. A sitemap.xml is metadata explicitly
published for crawlers to fetch — capturing one as a parser test fixture
raises no privacy or consent concern, unlike scanning a site's actual pages.

| File | Source | Captured | Notes |
|---|---|---|---|
| `urlset.xml` | `https://www.anthropic.com/sitemap.xml` | 2026-08-26 | Real single-level `urlset`. Original had 515 `<url>` entries; kept the first 12, unmodified. |
| `posts.xml` | `https://github.blog/post-sitemap.xml` | 2026-08-26 | Real WordPress/Yoast `urlset`. Original had 1001 entries across 280 KB; kept 6, including two with a real `<image:image><image:loc>` extension — the reason `parseSitemapXml` must read only a `<url>`'s own `<loc>`, not nested extension tags that happen to share the tag name. |
| `index.xml` | `https://github.blog/sitemap.xml` | 2026-08-26 | Real `sitemapindex`, kept complete (17 entries, 2.4 KB) — small enough not to need trimming. |

`discover.test.ts` does not use these files: it exercises index recursion,
same-origin filtering, and deduplication with small synthetic fixtures
written inline, because those behaviors need precise, engineered edge cases
rather than whatever a real site happens to contain.
