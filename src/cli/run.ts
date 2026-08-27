import { type Config, ConfigError, loadConfig } from '../config/index.js';
import { discoverSite } from '../discovery/index.js';
import { buildReport, writeReport } from '../report/index.js';
import { scan } from '../scan/index.js';

const DEFAULT_CONFIG_PATH = 'bfsg.config.yaml';

/**
 * Exit code contract:
 *   0 - scan completed
 *   2 - invalid or missing configuration
 *   3 - no pages were discovered, or one or more pages could not be scanned
 *       (navigation/browser failure)
 *
 * The JSON report is written for every completed scan, including one that
 * exits 3 for partial page failures — the partial results and the failures
 * themselves are still worth persisting.
 *
 * A threshold-based exit code (violations at or above `failOn`) lands with
 * scoring in a later change; every successful scan currently exits 0
 * regardless of what it found.
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

export async function run(argv: readonly string[]): Promise<number> {
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

  const result = await scan(urls, { wcagTags: config.wcagTags });

  const report = buildReport(result, {
    baseUrl: config.baseUrl,
    wcagTags: config.wcagTags,
    failOn: config.failOn,
  });
  const reportPath = await writeReport(report, config.outputDir);
  console.log(`Report written to ${reportPath}`);

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
  return 0;
}
