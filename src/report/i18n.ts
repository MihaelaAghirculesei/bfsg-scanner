/**
 * Localised strings for the human-facing HTML report. Two locales, a flat
 * table, no i18n library: the set is small, there is no runtime locale
 * negotiation, and every label is phrased to avoid grammatical agreement
 * (`Affected elements: 3`, not `3 elements`) so no plural rules are needed.
 * See ADR 0005.
 *
 * The JSON report stays language-neutral; a locale is chosen only when
 * rendering HTML.
 */

export type Locale = 'de' | 'en';

export interface Messages {
  /** `<title>` and the page's `<h1>`. */
  readonly reportTitle: string;
  readonly generatedAt: string;
  readonly tool: string;
  readonly target: string;
  readonly wcagTags: string;
  readonly threshold: string;

  readonly verdictPassed: string;
  readonly verdictFailed: string;
  /** Precedes the count of violations at or above the threshold. */
  readonly verdictFailedDetail: string;
  readonly unrankedNote: string;

  readonly summaryHeading: string;
  readonly pagesScanned: string;
  readonly pagesFailed: string;
  readonly pagesWithViolations: string;
  readonly totalViolations: string;
  readonly byImpact: string;
  readonly impactCritical: string;
  readonly impactSerious: string;
  readonly impactModerate: string;
  readonly impactMinor: string;
  readonly impactUnknown: string;

  readonly clausesHeading: string;
  readonly breachedSuccessCriteria: string;
  readonly breachedEn301549: string;
  readonly noClausesBreached: string;
  readonly clausesLegalNote: string;

  readonly findingsHeading: string;
  readonly pageScanFailed: string;
  readonly noViolations: string;
  readonly rule: string;
  readonly impact: string;
  readonly successCriteria: string;
  readonly en301549Clauses: string;
  readonly help: string;
  readonly affectedElements: string;
  readonly incompleteHeading: string;
  readonly incompleteNote: string;
  readonly none: string;
}

const EN: Messages = {
  reportTitle: 'Accessibility scan report',
  generatedAt: 'Generated at',
  tool: 'Tool',
  target: 'Target',
  wcagTags: 'Rule sets',
  threshold: 'Failure threshold',

  verdictPassed: 'Passed — no violations at or above the failure threshold.',
  verdictFailed: 'Failed',
  verdictFailedDetail: 'violation(s) at or above the failure threshold',
  unrankedNote:
    'violation(s) carry no impact rating from axe and were excluded from the threshold. Review them below.',

  summaryHeading: 'Summary',
  pagesScanned: 'Pages scanned',
  pagesFailed: 'Pages that failed to load',
  pagesWithViolations: 'Pages with violations',
  totalViolations: 'Violated rules (total)',
  byImpact: 'By impact',
  impactCritical: 'Critical',
  impactSerious: 'Serious',
  impactModerate: 'Moderate',
  impactMinor: 'Minor',
  impactUnknown: 'Unrated',

  clausesHeading: 'Breached clauses',
  breachedSuccessCriteria: 'WCAG 2.1 success criteria',
  breachedEn301549: 'EN 301 549 clauses',
  noClausesBreached: 'No WCAG or EN 301 549 clauses were breached by a confirmed violation.',
  clausesLegalNote:
    'For web content the BFSG (§ 3 (1), § 4) grants a presumption of conformity to sites meeting EN 301 549, whose Chapter 9 is WCAG 2.1 A/AA. The clauses above are the BFSG-relevant citations.',

  findingsHeading: 'Findings by page',
  pageScanFailed: 'This page could not be scanned',
  noViolations: 'No violations.',
  rule: 'Rule',
  impact: 'Impact',
  successCriteria: 'WCAG SC',
  en301549Clauses: 'EN 301 549',
  help: 'How to fix',
  affectedElements: 'Affected elements',
  incompleteHeading: 'Needs review',
  incompleteNote: 'axe could not decide these automatically. They are not counted as violations.',
  none: 'none',
};

const DE: Messages = {
  reportTitle: 'Bericht zur Barrierefreiheitsprüfung',
  generatedAt: 'Erstellt am',
  tool: 'Werkzeug',
  target: 'Ziel',
  wcagTags: 'Regelsätze',
  threshold: 'Schwellenwert für Fehlschlag',

  verdictPassed: 'Bestanden — keine Verstöße auf oder über dem Schwellenwert.',
  verdictFailed: 'Nicht bestanden',
  verdictFailedDetail: 'Verstoß/Verstöße auf oder über dem Schwellenwert',
  unrankedNote:
    'Verstoß/Verstöße ohne Schweregrad von axe wurden vom Schwellenwert ausgenommen. Bitte unten prüfen.',

  summaryHeading: 'Zusammenfassung',
  pagesScanned: 'Geprüfte Seiten',
  pagesFailed: 'Nicht ladbare Seiten',
  pagesWithViolations: 'Seiten mit Verstößen',
  totalViolations: 'Verletzte Regeln (gesamt)',
  byImpact: 'Nach Schweregrad',
  impactCritical: 'Kritisch',
  impactSerious: 'Schwerwiegend',
  impactModerate: 'Mittel',
  impactMinor: 'Gering',
  impactUnknown: 'Ohne Bewertung',

  clausesHeading: 'Verletzte Anforderungen',
  breachedSuccessCriteria: 'WCAG-2.1-Erfolgskriterien',
  breachedEn301549: 'EN-301-549-Anforderungen',
  noClausesBreached:
    'Kein WCAG- oder EN-301-549-Kriterium wurde durch einen bestätigten Verstoß verletzt.',
  clausesLegalNote:
    'Für Webinhalte begründet das BFSG (§ 3 Abs. 1, § 4) eine Konformitätsvermutung für Angebote, die EN 301 549 erfüllen; deren Kapitel 9 entspricht WCAG 2.1 A/AA. Die oben genannten Anforderungen sind die BFSG-relevanten Fundstellen.',

  findingsHeading: 'Ergebnisse nach Seite',
  pageScanFailed: 'Diese Seite konnte nicht geprüft werden',
  noViolations: 'Keine Verstöße.',
  rule: 'Regel',
  impact: 'Schweregrad',
  successCriteria: 'WCAG-EK',
  en301549Clauses: 'EN 301 549',
  help: 'Behebung',
  affectedElements: 'Betroffene Elemente',
  incompleteHeading: 'Manuelle Prüfung nötig',
  incompleteNote:
    'axe konnte dies nicht automatisch entscheiden. Es wird nicht als Verstoß gezählt.',
  none: 'keine',
};

const MESSAGES: Readonly<Record<Locale, Messages>> = { de: DE, en: EN };

export function messagesFor(locale: Locale): Messages {
  return MESSAGES[locale];
}
