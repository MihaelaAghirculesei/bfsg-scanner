import { parseArgs } from 'node:util';
import { type Browser, chromium } from 'playwright';
import { type Config, ConfigError, loadConfig, parseConfig } from '../config/index.js';
import { discoverSite } from '../discovery/index.js';
import {
  buildReport,
  renderHtmlReport,
  renderPdfReport,
  writeHtmlReport,
  writePdfReport,
  writeReport,
} from '../report/index.js';
import { type ScanDeps, scan } from '../scan/index.js';
import { toolInfo } from '../shared/index.js';

const DEFAULT_CONFIG_PATH = 'bfsg.config.yaml';

const HELP_TEXT = `bfsg-scanner — WCAG 2.1 AA / EN 301 549 / BFSG accessibility scanner

Usage:
  bfsg-scanner [url] [options]

Arguments:
  url                        Base URL to scan. Omit to load a config file instead.

Options:
  -c, --config <path>        YAML config file (default: ${DEFAULT_CONFIG_PATH}).
                             Not allowed together with a url argument.
      --fail-on <level>      critical | serious | moderate | minor (default: serious).
      --report-language <l>  de | en (default: de).
      --output-dir <dir>     Directory for the report files (default: reports).
      --format <list>        Comma-separated subset of json,html,pdf (default: all three).
  -h, --help                 Show this help and exit.
  -V, --version              Print the version and exit.

Exit codes:
  0  scan completed, nothing at or above the fail-on threshold
  1  scan completed, violations at or above fail-on
  2  invalid arguments or configuration
  3  no pages discovered, or a page could not be scanned
`;

interface CliArgs {
  readonly help: boolean;
  readonly version: boolean;
  /** Explicit --config path, if given. */
  readonly configPath?: string;
  /** Positional base URL, if given. */
  readonly url?: string;
  /**
   * Config fields overridden on the command line, still as raw values —
   * `configSchema` is the single place they get validated.
   */
  readonly overrides: Record<string, unknown>;
}

const OPTIONS = {
  help: { type: 'boolean', short: 'h' },
  version: { type: 'boolean', short: 'V' },
  config: { type: 'string', short: 'c' },
  'fail-on': { type: 'string' },
  'report-language': { type: 'string' },
  'output-dir': { type: 'string' },
  format: { type: 'string' },
} as const;

function safeParseArgs(argv: readonly string[]) {
  try {
    return parseArgs({ args: [...argv], options: OPTIONS, allowPositionals: true });
  } catch (cause) {
    throw new ConfigError((cause as Error).message);
  }
}

/**
 * Exit code contract:
 *   0 - scan completed, nothing at or above the `failOn` threshold
 *   1 - scan completed, violations at or above `failOn` were found
 *   2 - invalid arguments or configuration
 *   3 - no pages were discovered, or one or more pages could not be scanned
 *
 * 3 outranks 1: a run with unreachable pages scanned an incomplete site, so
 * "no violations found" would be a claim the data cannot support. The
 * report is still written first, so partial results and failure entries
 * survive either way.
 */
export function parseCliArgs(argv: readonly string[]): CliArgs {
  const { values, positionals } = safeParseArgs(argv);

  if (positionals.length > 1) {
    throw new ConfigError(`Expected at most one URL argument, got ${positionals.length}.`);
  }
  const url = positionals[0];
  if (url !== undefined && values.config !== undefined) {
    throw new ConfigError('Pass a URL argument or --config, not both.');
  }

  const overrides: Record<string, unknown> = {};
  if (values['fail-on'] !== undefined) {
    overrides.failOn = values['fail-on'];
  }
  if (values['report-language'] !== undefined) {
    overrides.reportLanguage = values['report-language'];
  }
  if (values['output-dir'] !== undefined) {
    overrides.outputDir = values['output-dir'];
  }
  if (values.format !== undefined) {
    overrides.reportFormats = values.format
      .split(',')
      .map((part) => part.trim())
      .filter((part) => part.length > 0);
  }

  return {
    help: values.help ?? false,
    version: values.version ?? false,
    overrides,
    ...(values.config !== undefined ? { configPath: values.config } : {}),
    ...(url !== undefined ? { url } : {}),
  };
}

function resolveConfig(cli: CliArgs): Config {
  if (cli.url !== undefined) {
    return parseConfig({ baseUrl: cli.url, ...cli.overrides }, 'command-line arguments');
  }
  const fromFile = loadConfig(cli.configPath ?? DEFAULT_CONFIG_PATH);
  if (Object.keys(cli.overrides).length === 0) {
    return fromFile;
  }
  return parseConfig({ ...fromFile, ...cli.overrides }, 'command-line arguments');
}

export async function run(argv: readonly string[], deps: ScanDeps = {}): Promise<number> {
  let cli: CliArgs;
  try {
    cli = parseCliArgs(argv);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    return 2;
  }

  if (cli.help) {
    console.log(HELP_TEXT);
    return 0;
  }
  if (cli.version) {
    const { name, version } = toolInfo();
    console.log(`${name} ${version}`);
    return 0;
  }

  let config: Config;
  try {
    config = resolveConfig(cli);
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

  // One Chromium for the whole run: the scan uses it, and the PDF report is
  // printed with it. `run` closes only a browser it launched itself, so an
  // injected one (tests) is left to its owner — the same contract `scan` keeps.
  const browser = deps.browser ?? (await chromium.launch());
  const launchedHere = deps.browser === undefined;
  try {
    return await scanAndReport(config, urls, browser);
  } finally {
    if (launchedHere) {
      await browser.close();
    }
  }
}

async function scanAndReport(
  config: Config,
  urls: readonly string[],
  browser: Browser,
): Promise<number> {
  const result = await scan(urls, { wcagTags: config.wcagTags }, { browser });

  const report = buildReport(result, {
    baseUrl: config.baseUrl,
    wcagTags: config.wcagTags,
    failOn: config.failOn,
  });

  const formats = new Set(config.reportFormats);
  if (formats.has('json')) {
    console.log(`Report written to ${await writeReport(report, config.outputDir)}`);
  }
  if (formats.has('html') || formats.has('pdf')) {
    const html = renderHtmlReport(report, config.reportLanguage);
    if (formats.has('html')) {
      console.log(`HTML report written to ${await writeHtmlReport(html, config.outputDir)}`);
    }
    if (formats.has('pdf')) {
      const pdf = await renderPdfReport(html, browser);
      console.log(`PDF report written to ${await writePdfReport(pdf, config.outputDir)}`);
    }
  }

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
