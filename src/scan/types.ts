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

export interface PageScanResult {
  readonly url: string;
  readonly violations: readonly ScanFinding[];
  readonly incomplete: readonly ScanFinding[];
}

export interface ScanResult {
  readonly pages: readonly PageScanResult[];
}

export interface ScanOptions {
  readonly wcagTags: readonly string[];
}
