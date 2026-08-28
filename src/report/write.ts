import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Report } from './types.js';

/** Canonical report filenames inside the configured output directory. */
export const REPORT_FILENAME = 'report.json';
export const HTML_REPORT_FILENAME = 'report.html';
export const PDF_REPORT_FILENAME = 'report.pdf';

/**
 * Writes the report as pretty-printed JSON to `<outputDir>/report.json`,
 * creating the directory if needed and overwriting any previous run.
 * Returns the path written.
 */
export function writeReport(report: Report, outputDir: string): Promise<string> {
  return writeArtifact(outputDir, REPORT_FILENAME, `${JSON.stringify(report, null, 2)}\n`);
}

/**
 * Writes a pre-rendered HTML report to `<outputDir>/report.html`, alongside
 * the JSON. Same overwrite semantics. Returns the path written.
 */
export function writeHtmlReport(html: string, outputDir: string): Promise<string> {
  return writeArtifact(outputDir, HTML_REPORT_FILENAME, html.endsWith('\n') ? html : `${html}\n`);
}

/**
 * Writes pre-rendered PDF bytes to `<outputDir>/report.pdf`, alongside the
 * JSON and HTML. Same overwrite semantics. Returns the path written.
 */
export function writePdfReport(pdf: Uint8Array, outputDir: string): Promise<string> {
  return writeArtifact(outputDir, PDF_REPORT_FILENAME, pdf);
}

async function writeArtifact(
  outputDir: string,
  filename: string,
  content: string | Uint8Array,
): Promise<string> {
  await mkdir(outputDir, { recursive: true });
  const path = join(outputDir, filename);
  await writeFile(path, content);
  return path;
}
