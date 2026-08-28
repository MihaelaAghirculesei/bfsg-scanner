import { type Config, ConfigError, loadConfig } from '../config/index.js';
import { discoverSite } from '../discovery/index.js';
import { buildReport, renderHtmlReport, writeHtmlReport, writeReport } from '../report/index.js';
import { type ScanDeps, scan } from '../scan/index.js';

const DEFAULT_CONFIG_PATH = 'bfsg.config.yaml';

/**
 * Exit code contract:
 *   0 - scan completed, nothing at or above the `failOn` threshold
 *   1 - scan completed, violations at or above `failOn` were found
 *   2 - invalid or missing configuration
 *   3 - no pages were discovered, or one or more pages could not be scanned
 *       (navigation/browser failure)
 *
 * 3 outranks 1: a run with unreachable pages scanned an incomplete site, so
 * "no violations found" would be a claim the data cannot support. The
 * report is still written first, so the partial results and the failure
 * entries survive either way.
 */
export function parseArgs(argv: readonly string[]): { configPath: string } {
  const flagIndex = argv.indexOf('--config');
  if (flagIndex === -1) {
    return { configPath: DEFAULT_CONFIG_PATH };
  }

  const configPath = argv[flagIndex + 1];
  if (!configPath) {
    throw new ConfigError('--config flag requires a path argument');
  }

  return { configPath };
}

export async function run(argv: readonly string[], deps: ScanDeps = {}): Promise<number> {
  let configPath: string;
  try {
    ({ configPath } = parseArgs(argv));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    return 2;
  }

  let config: Config;
  try {
    config = loadConfig(configPath);
  } catch (error) {
    if (error instanceof ConfigError) {
      console.error(error.message);
      return 2;
    }
    throw error;
  }

  const urls = await discoverSite({
    baseUrl: config.baseUrl,
    maxPages: config.maxPages,
    excludePaths: config.excludePaths,
  });
  if (urls.length === 0) {
    console.error(`No scannable pages discovered for ${config.baseUrl}`);
    return 3;
  }
  console.log(`Discovered ${urls.length} page(s) to scan.`);

  const result = await scan(urls, { wcagTags: config.wcagTags }, deps);

  const report = buildReport(result, {
    baseUrl: config.baseUrl,
    wcagTags: config.wcagTags,
    failOn: config.failOn,
  });
  const reportPath = await writeReport(report, config.outputDir);
  console.log(`Report written to ${reportPath}`);
  const htmlPath = await writeHtmlReport(
    renderHtmlReport(report, config.reportLanguage),
    config.outputDir,
  );
  console.log(`HTML report written to ${htmlPath}`);

  const failedPages = result.pages.filter((page) => page.status === 'error');
  if (failedPages.length > 0) {
    for (const page of failedPages) {
      console.error(`Failed to scan ${page.url}: ${page.error}`);
    }
    return 3;
  }

  console.log(
    `Scanned ${report.summary.pagesScanned} page(s), ${report.summary.totalViolations} rule(s) violated.`,
  );

  const { breachedSuccessCriteria, breachedEn301549Clauses } = report.summary;
  if (breachedSuccessCriteria.length > 0) {
    console.log(`WCAG 2.1 SC breached: ${breachedSuccessCriteria.join(', ')}`);
    console.log(`EN 301 549 clauses breached: ${breachedEn301549Clauses.join(', ')}`);
  }

  const { verdict } = report;
  if (verdict.unrankedViolations > 0) {
    console.warn(
      `${verdict.unrankedViolations} violation(s) carry no impact rating and were excluded from the ${config.failOn} threshold. Review them in the report.`,
    );
  }

  if (!verdict.passed) {
    console.error(
      `${verdict.violationsAtOrAboveThreshold} violation(s) at or above "${config.failOn}".`,
    );
    return 1;
  }
  return 0;
}
