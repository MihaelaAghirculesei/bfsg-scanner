import type { PageScanResult } from '../scan/index.js';

export interface ReportToolInfo {
  readonly name: string;
  readonly version: string;
}

/** The scan inputs the report echoes back, so a stored report is self-describing. */
export interface ReportTarget {
  readonly baseUrl: string;
  readonly wcagTags: readonly string[];
  readonly failOn: string;
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

export interface Report {
  readonly schemaVersion: number;
  readonly generatedAt: string;
  readonly tool: ReportToolInfo;
  readonly target: ReportTarget;
  readonly summary: ReportSummary;
  /** Per-page results, verbatim from the scan engine (failures included). */
  readonly pages: readonly PageScanResult[];
}
