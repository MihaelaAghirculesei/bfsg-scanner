import type { ImpactValue, UnlabelledFrameSelector } from 'axe-core';
import type { Browser } from 'playwright';

export interface ScanNode {
  readonly target: UnlabelledFrameSelector;
  readonly html: string;
  readonly failureSummary: string | null;
}

export interface ScanFinding {
  readonly ruleId: string;
  /**
   * The axe-core rule's tags, verbatim. Carries the standards mapping the
   * report layer turns into clauses: `wcag<digits>` (a WCAG success
   * criterion), `EN-9.x.x.x` (an EN 301 549 clause), plus category and
   * ruleset markers. See `src/report/clauses.ts`.
   */
  readonly tags: readonly string[];
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
  /** Maximum number of pages scanned in parallel. Defaults to 3. */
  readonly concurrency?: number;
  /** Minimum time between two requests to the same host, in milliseconds. Defaults to 1000. */
  readonly hostRateLimitMs?: number;
}

export interface ScanDeps {
  /**
   * Reuse an already-launched browser instead of launching one per call.
   * The caller owns its lifecycle: `scan` never closes a browser it did
   * not launch. Each page still gets its own fresh, isolated context.
   */
  readonly browser?: Browser;
}
