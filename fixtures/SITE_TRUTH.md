# fixtures/site — ground truth

Golden-test fixtures for the scan engine. Every page below was verified against
a real run of `axe-core@4.13.0` in Chromium via Playwright, scoped to the same
rule set the scanner uses (`--tags wcag2a,wcag2aa,wcag21aa`). These numbers are
not estimates — they are what the tool must reproduce exactly. If a future
axe-core upgrade changes any of them, the golden test (`src/scan/*.e2e.test.ts`,
added on top of this fixture set) will fail and this file must be updated
alongside the explanation, not silently.

| Page | Violations | Rule | Nodes | WCAG SC | EN 301 549 |
|---|---|---|---|---|---|
| `clean.html` | 0 | — | — | — | — |
| `contrast.html` | 1 | `color-contrast` | 1 | 1.4.3 | 9.1.4.3 |
| `missing-alt.html` | 1 | `image-alt` | 1 | 1.1.1 | 9.1.1.1 |
| `missing-label.html` | 1 | `label` | 1 | 4.1.2 | 9.4.1.2 |
| `missing-lang.html` | 1 | `html-has-lang` | 1 | 3.1.1 | 9.3.1.1 |
| `unnamed-link.html` | 1 | `link-name` | 1 | 2.4.4, 4.1.2 | 9.2.4.4, 9.4.1.2 |

Total across the fixture site: **6 pages, 5 violations, 0 `incomplete` results.**

The WCAG SC and EN 301 549 columns are read straight from each axe rule's
`tags` (`wcag143` → SC 1.4.3, `EN-9.1.4.3` → clause 9.1.4.3), not authored by
hand — see `src/report/clauses.ts` and ADR 0004. `src/scan/scan.e2e.test.ts`
asserts them alongside the rule and node counts.

## Why these five rules, not "heading order"

The original sketch for this fixture set included a heading-order violation.
`heading-order` is tagged `cat.semantics` / `best-practice` in axe-core, not
`wcag2a` / `wcag2aa` / `wcag21aa` — so with the scanner's default rule set it
would never fire, and a fixture built around it would silently test nothing.
Verified via `axe.getRules(['wcag2a','wcag2aa','wcag21aa'])` before writing
any fixture HTML; `link-name` took its place instead.

## Design notes

- Each violation page is a copy of `clean.html` with exactly one deliberate
  defect. Everything else — `lang`, `title`, contrast, the labelled form
  field, the named link, the alt text — stays correct, so a page can only
  ever produce the one violation it is named for.
- `unnamed-link.html` uses `alt=""` (not a missing `alt`) on the image inside
  the link. A missing `alt` would also trigger `image-alt` on the same
  element, muddying the count; an empty `alt` is valid markup (it marks the
  image as decorative) and isolates the failure to `link-name`.
- `contrast.html` uses `#aaaaaa` text on `#ffffff` (contrast ratio ≈ 2.3:1),
  well under the 4.5:1 threshold for normal-size text.

## Reproducing this table

```
node fixtures/verify.mjs   # added once src/scan exists (Day 5)
```

Until the real scan engine lands, the table above was produced with a
one-off script (Playwright + axe-core, not committed) that served
`fixtures/site/` over `src/testing/static-server.ts` and ran
`axe.run(document, { runOnly: { type: 'tag', values: [...] } })` against
each page.
