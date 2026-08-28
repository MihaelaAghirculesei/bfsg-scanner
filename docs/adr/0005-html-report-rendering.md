# 5. HTML report rendering

Date: 2026-08-28

## Status

Accepted

## Context

`bfsg.config.yaml` has always advertised JSON, HTML and PDF output and a
`reportLanguage: de | en` setting, but only JSON was written and
`reportLanguage` was loaded and then ignored. The JSON report (ADR 0002) is
the machine artifact; a compliance run also needs something a person —
often a non-engineer acting on the BFSG obligation — can open and read, in
German by default.

## Decision

Add `renderHtmlReport(report, locale)` (`src/report/render.ts`) and
`writeHtmlReport(html, outputDir)` (`src/report/write.ts`). The CLI writes
`<outputDir>/report.html` right after `report.json`, using
`config.reportLanguage`.

**Self-contained single file.** One HTML document with an inline `<style>`,
no JavaScript, and no external assets. It has to survive being archived as a
CI artifact, opened offline, emailed, and — next change — printed to PDF by
a headless browser. A build step or an asset bundle would work against all
of that.

**Hand-written string table, not an i18n library** (`src/report/i18n.ts`).
Two locales, ~40 keys, chosen once from config with no runtime negotiation.
Every label is phrased to sidestep grammatical agreement
(`Affected elements: 3`, not `3 elements`), so ICU plural handling buys
nothing. A dependency here would be more API surface and supply chain than
the problem has.

**The JSON stays language-neutral.** A locale is a rendering argument, not
report data: the same scan produces one `report.json` and can be rendered to
either language. `Report` is unchanged, so `schemaVersion` is untouched —
HTML is not part of the schema.

**What the page leads with.** Verdict banner, then the summary, then the
breached WCAG / EN 301 549 clauses from the scan (ADR 0004) as the headline
compliance statement, then findings per page with the rule, impact, its
clauses, the fix link, and the offending node markup as evidence. All
interpolated text — URLs, rule evidence, error strings — is HTML-escaped;
node HTML from axe is attacker-influenced (it is markup from the scanned
site) and must never render as live markup in the report.

## Consequences

- A new on-disk artifact, `report.html`, overwritten each run like the JSON.
  `outputDir` is git-ignored; `maxPages` still bounds total size, and the
  full node markup makes the HTML larger than the JSON per finding.
- The renderer duplicates presentation logic that a consumer of the JSON
  would otherwise write. That is the point of shipping it, but it means the
  clause/summary semantics now have two readers (JSON consumers and this
  renderer) to keep in step.
- Adding a locale is a third column in `i18n.ts` plus a `Locale` union
  member; the "same keys in every locale" test fails until it is complete.
- `reportLanguage` localises the report's own chrome — headings, labels,
  the verdict, the legal note. axe-core's rule `help` text and node failure
  summaries are English and are shown as axe emits them; translating
  upstream rule copy is out of scope.
- PDF is still not produced. It needs a browser in the report path
  (Playwright's `page.pdf()` over this HTML) and its own lifecycle and
  testing story — a separate change. The print CSS in this one is written
  with that in mind.
- The CLI still only prints "N rule(s) violated" — surfacing the breached
  clauses in the terminal is a separate, small follow-up.
