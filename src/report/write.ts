import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Report } from './types.js';

/** Canonical report filename inside the configured output directory. */
export const REPORT_FILENAME = 'report.json';

/**
 * Writes the report as pretty-printed JSON to `<outputDir>/report.json`,
 * creating the directory if needed and overwriting any previous run.
 * Returns the path written.
 */
export async function writeReport(report: Report, outputDir: string): Promise<string> {
  await mkdir(outputDir, { recursive: true });
  const path = join(outputDir, REPORT_FILENAME);
  await writeFile(path, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  return path;
}
