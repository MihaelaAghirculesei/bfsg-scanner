import type { ImpactValue, UnlabelledFrameSelector } from 'axe-core';

export interface ScanNode {
  readonly target: UnlabelledFrameSelector;
  readonly html: string;
  readonly failureSummary: string | null;
}

export interface ScanFinding {
  readonly ruleId: string;
  readonly impact: ImpactValue;
  readonly description: string;
  readonly help: string;
  readonly helpUrl: string;
  readonly nodes: readonly ScanNode[];
}

export interface PageScanSuccess {
  readonly status: 'ok';
  readonly url: string;
  readonly violations: readonly ScanFinding[];
  readonly incomplete: readonly ScanFinding[];
}

export interface PageScanFailure {
  readonly status: 'error';
  readonly url: string;
  readonly error: string;
}

export type PageScanResult = PageScanSuccess | PageScanFailure;

export interface ScanResult {
  readonly pages: readonly PageScanResult[];
}

export interface ScanOptions {
  readonly wcagTags: readonly string[];
  /** Navigation timeout per attempt, in milliseconds. Defaults to 15000. */
  readonly timeoutMs?: number;
  /** Extra attempts after the first one fails. Defaults to 1 (two attempts total). */
  readonly retries?: number;
}
