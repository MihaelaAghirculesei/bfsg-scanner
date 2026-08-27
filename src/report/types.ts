import type { PageScanResult } from '../scan/index.js';
import type { ImpactThreshold } from './verdict.js';

export interface ReportToolInfo {
  readonly name: string;
  readonly version: string;
}

/** The scan inputs the report echoes back, so a stored report is self-describing. */
export interface ReportTarget {
  readonly baseUrl: string;
  readonly wcagTags: readonly string[];
  readonly failOn: ImpactThreshold;
}

/** Violation (rule) counts bucketed by axe-core impact; `unknown` is impact `null`. */
export interface ReportImpactCounts {
  readonly critical: number;
  readonly serious: number;
  readonly moderate: number;
  readonly minor: number;
  readonly unknown: number;
}

export interface ReportSummary {
  readonly pagesScanned: number;
  readonly pagesFailed: number;
  readonly pagesWithViolations: number;
  /** Total violated rules across all pages (not node count). */
  readonly totalViolations: number;
  readonly violationsByImpact: ReportImpactCounts;
}

/**
 * The pass/fail call against `target.failOn`.
 *
 * Scoped to what was actually scanned: a page that failed to load is
 * reported in `summary.pagesFailed` and drives the CLI exit code, but it
 * cannot make a verdict pass or fail, because its compliance is unknown.
 */
export interface ReportVerdict {
  /** Violated rules whose impact is at or above `target.failOn`. */
  readonly violationsAtOrAboveThreshold: number;
  /** Violated rules whose impact axe left unset, excluded from the count above. */
  readonly unrankedViolations: number;
  readonly passed: boolean;
}

export interface Report {
  readonly schemaVersion: number;
  readonly generatedAt: string;
  readonly tool: ReportToolInfo;
  readonly target: ReportTarget;
  readonly summary: ReportSummary;
  readonly verdict: ReportVerdict;
  /** Per-page results, verbatim from the scan engine (failures included). */
  readonly pages: readonly PageScanResult[];
}
