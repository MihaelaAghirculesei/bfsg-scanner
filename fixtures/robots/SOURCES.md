# fixtures/robots — provenance

| File | Source | Captured | Notes |
|---|---|---|---|
| `wikipedia-robots.txt` | `https://en.wikipedia.org/robots.txt` | 2026-08-26 | Real file (711 lines originally), trimmed to the header, one unrelated bot group (`MJ12bot`), and the first 14 lines of the `User-agent: *` group. Kept the leading UTF-8 BOM exactly as served — a real quirk the parser must strip. The `Allow: /w/api.php?action=mobileview&` vs `Disallow: /w/` pair is the reason this file was chosen: it is a genuine, published example of the "longest match wins, Allow breaks ties" rule that a naive first-match parser would get wrong. |

`robots.test.ts` also asserts that the `MJ12bot` group's blanket `Disallow: /` does not affect `User-agent: *` lookups — proof that groups are matched by agent, not merged.
