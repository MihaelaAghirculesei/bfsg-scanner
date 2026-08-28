import type { ImpactValue } from 'axe-core';
import { type Locale, type Messages, messagesFor } from './i18n.js';
import type { Report, ReportFinding, ReportImpactCounts, ReportPage } from './types.js';

/**
 * Renders a `Report` as a single self-contained HTML document: inline CSS,
 * no JavaScript, no external assets. It is meant to be archived by CI,
 * opened offline, and printed to PDF (a later change). See ADR 0005.
 */
export function renderHtmlReport(report: Report, locale: Locale): string {
  const m = messagesFor(locale);
  const body = [
    header(report, m),
    verdictBanner(report, m),
    summarySection(report, m),
    clausesSection(report, m),
    findingsSection(report, m),
  ].join('\n');

  return [
    '<!doctype html>',
    `<html lang="${locale}">`,
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${esc(m.reportTitle)} — ${esc(report.target.baseUrl)}</title>`,
    `<style>${STYLE}</style>`,
    '</head>',
    '<body>',
    body,
    '</body>',
    '</html>',
    '',
  ].join('\n');
}

function header(report: Report, m: Messages): string {
  const { target, tool, generatedAt } = report;
  return section(`
    <h1>${esc(m.reportTitle)}</h1>
    <dl class="meta">
      ${row(m.target, link(target.baseUrl))}
      ${row(m.generatedAt, esc(generatedAt))}
      ${row(m.tool, esc(`${tool.name} ${tool.version}`))}
      ${row(m.wcagTags, esc(target.wcagTags.join(', ')))}
      ${row(m.threshold, esc(target.failOn))}
    </dl>`);
}

function verdictBanner(report: Report, m: Messages): string {
  const { verdict } = report;
  const status = verdict.passed ? 'pass' : 'fail';
  const headline = verdict.passed
    ? esc(m.verdictPassed)
    : `<strong>${esc(m.verdictFailed)}</strong> — ${verdict.violationsAtOrAboveThreshold} ${esc(
        m.verdictFailedDetail,
      )}`;
  const unranked =
    verdict.unrankedViolations > 0
      ? `<p class="unranked">${verdict.unrankedViolations} ${esc(m.unrankedNote)}</p>`
      : '';
  return `<div class="banner ${status}"><p>${headline}</p>${unranked}</div>`;
}

function summarySection(report: Report, m: Messages): string {
  const s = report.summary;
  const impacts: [keyof ReportImpactCounts, string][] = [
    ['critical', m.impactCritical],
    ['serious', m.impactSerious],
    ['moderate', m.impactModerate],
    ['minor', m.impactMinor],
    ['unknown', m.impactUnknown],
  ];
  return section(`
    <h2>${esc(m.summaryHeading)}</h2>
    <dl class="meta">
      ${row(m.pagesScanned, String(s.pagesScanned))}
      ${row(m.pagesFailed, String(s.pagesFailed))}
      ${row(m.pagesWithViolations, String(s.pagesWithViolations))}
      ${row(m.totalViolations, String(s.totalViolations))}
    </dl>
    <h3>${esc(m.byImpact)}</h3>
    <ul class="impacts">
      ${impacts
        .map(
          ([key, label]) =>
            `<li><span>${esc(label)}</span><b>${s.violationsByImpact[key]}</b></li>`,
        )
        .join('\n      ')}
    </ul>`);
}

function clausesSection(report: Report, m: Messages): string {
  const { breachedSuccessCriteria, breachedEn301549Clauses } = report.summary;
  if (breachedSuccessCriteria.length === 0 && breachedEn301549Clauses.length === 0) {
    return section(`
      <h2>${esc(m.clausesHeading)}</h2>
      <p>${esc(m.noClausesBreached)}</p>`);
  }
  return section(`
    <h2>${esc(m.clausesHeading)}</h2>
    <p class="clause-group"><span>${esc(m.breachedSuccessCriteria)}</span>${chips(
      breachedSuccessCriteria,
    )}</p>
    <p class="clause-group"><span>${esc(m.breachedEn301549)}</span>${chips(
      breachedEn301549Clauses,
    )}</p>
    <p class="legal">${esc(m.clausesLegalNote)}</p>`);
}

function findingsSection(report: Report, m: Messages): string {
  const pages = report.pages.map((page) => pageBlock(page, m)).join('\n');
  return section(`
    <h2>${esc(m.findingsHeading)}</h2>
    ${pages}`);
}

function pageBlock(page: ReportPage, m: Messages): string {
  if (page.status === 'error') {
    return `<article class="page failed">
      <h3>${link(page.url)}</h3>
      <p class="scan-failed">${esc(m.pageScanFailed)}: <code>${esc(page.error)}</code></p>
    </article>`;
  }

  const parts: string[] = [`<h3>${link(page.url)}</h3>`];
  if (page.violations.length === 0 && page.incomplete.length === 0) {
    parts.push(`<p class="ok">${esc(m.noViolations)}</p>`);
  }
  parts.push(...page.violations.map((f) => findingBlock(f, m)));
  if (page.incomplete.length > 0) {
    parts.push(`<h4>${esc(m.incompleteHeading)}</h4>`);
    parts.push(`<p class="note">${esc(m.incompleteNote)}</p>`);
    parts.push(...page.incomplete.map((f) => findingBlock(f, m)));
  }
  return `<article class="page">${parts.join('\n')}</article>`;
}

function findingBlock(f: ReportFinding, m: Messages): string {
  return `<div class="finding impact-${esc(impactClass(f.impact))}">
    <p class="finding-head">
      <code>${esc(f.ruleId)}</code>
      <span class="badge">${esc(m.impact)}: ${esc(f.impact ?? m.impactUnknown)}</span>
    </p>
    <p class="finding-desc">${esc(f.help)}</p>
    <dl class="meta">
      ${row(m.successCriteria, f.clauses.wcagSc.length > 0 ? esc(f.clauses.wcagSc.join(', ')) : esc(m.none))}
      ${row(m.en301549Clauses, f.clauses.en301549.length > 0 ? esc(f.clauses.en301549.join(', ')) : esc(m.none))}
      ${row(m.help, `<a href="${esc(f.helpUrl)}">${esc(f.helpUrl)}</a>`)}
      ${row(m.affectedElements, String(f.nodes.length))}
    </dl>
    ${f.nodes
      .map(
        (n) =>
          `<pre class="node"><code>${esc(n.html)}</code></pre>${
            n.failureSummary ? `<p class="node-summary">${esc(n.failureSummary)}</p>` : ''
          }`,
      )
      .join('\n')}
  </div>`;
}

function impactClass(impact: ImpactValue): string {
  return impact ?? 'unknown';
}

function section(inner: string): string {
  return `<section>${inner}\n</section>`;
}

function row(label: string, valueHtml: string): string {
  return `<div><dt>${esc(label)}</dt><dd>${valueHtml}</dd></div>`;
}

function chips(values: readonly string[]): string {
  return values.map((v) => `<code class="chip">${esc(v)}</code>`).join(' ');
}

function link(url: string): string {
  return `<a href="${esc(url)}">${esc(url)}</a>`;
}

/** HTML-escapes text for use in element content and double-quoted attributes. */
function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const STYLE = `
  :root { color-scheme: light dark; }
  * { box-sizing: border-box; }
  body { margin: 0 auto; max-width: 60rem; padding: 2rem 1.25rem;
    font: 16px/1.55 system-ui, -apple-system, Segoe UI, Roboto, sans-serif; }
  h1 { font-size: 1.6rem; margin: 0 0 1rem; }
  h2 { font-size: 1.25rem; margin: 2rem 0 0.75rem; border-bottom: 1px solid; padding-bottom: 0.25rem; }
  h3 { font-size: 1.05rem; margin: 1.5rem 0 0.5rem; word-break: break-all; }
  h4 { font-size: 0.95rem; margin: 1rem 0 0.35rem; }
  a { color: inherit; }
  code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 0.9em; }
  dl.meta { display: grid; grid-template-columns: max-content 1fr; gap: 0.15rem 1rem; margin: 0.5rem 0; }
  dl.meta > div { display: contents; }
  dl.meta dt { font-weight: 600; }
  dl.meta dd { margin: 0; word-break: break-word; }
  .banner { margin: 1rem 0; padding: 0.75rem 1rem; border-radius: 6px; border: 1px solid; }
  .banner.pass { background: #e6f4ea; border-color: #1e7e34; color: #14532d; }
  .banner.fail { background: #fdecea; border-color: #b02a37; color: #7a1620; }
  .banner p { margin: 0.15rem 0; }
  .banner .unranked { font-size: 0.9rem; }
  ul.impacts { list-style: none; padding: 0; margin: 0.35rem 0; display: flex; flex-wrap: wrap; gap: 0.5rem; }
  ul.impacts li { border: 1px solid; border-radius: 4px; padding: 0.2rem 0.55rem; }
  ul.impacts li span { margin-right: 0.4rem; }
  .clause-group span { font-weight: 600; margin-right: 0.5rem; }
  code.chip { border: 1px solid; border-radius: 4px; padding: 0.1rem 0.4rem; display: inline-block; margin: 0.1rem 0; }
  .legal { font-size: 0.9rem; opacity: 0.85; }
  article.page { margin: 0.5rem 0 1.5rem; }
  .finding { border-left: 4px solid #b02a37; padding: 0.5rem 0.9rem; margin: 0.75rem 0; background: rgba(127,127,127,0.06); }
  .finding.impact-moderate, .finding.impact-minor { border-left-color: #b8860b; }
  .finding.impact-unknown { border-left-color: #6c757d; }
  .finding-head { margin: 0 0 0.35rem; display: flex; gap: 0.6rem; align-items: baseline; flex-wrap: wrap; }
  .badge { font-size: 0.8rem; border: 1px solid; border-radius: 4px; padding: 0.05rem 0.4rem; }
  .finding-desc { margin: 0.25rem 0; }
  pre.node { overflow-x: auto; padding: 0.5rem 0.7rem; background: rgba(127,127,127,0.12); border-radius: 4px; }
  .node-summary { white-space: pre-wrap; font-size: 0.9rem; margin: 0.15rem 0 0.6rem; }
  .scan-failed code { color: #b02a37; }
  @media print { body { max-width: none; } .finding { break-inside: avoid; } }
`;
