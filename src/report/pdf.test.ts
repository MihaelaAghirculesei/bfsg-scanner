import { type Browser, chromium } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { renderPdfReport } from './pdf.js';

// One Chromium for the file: renderPdfReport takes an injected browser and
// never closes it, so every test here shares a single launch.
let browser: Browser;

beforeAll(async () => {
  browser = await chromium.launch();
});

afterAll(async () => {
  await browser.close();
});

const HTML =
  '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>t</title>' +
  '<style>body{font-family:sans-serif}</style></head><body><h1>Report</h1>' +
  '<p>Some content that should land in the PDF.</p></body></html>';

describe('renderPdfReport', () => {
  it('returns bytes that begin with the PDF magic number', async () => {
    const pdf = await renderPdfReport(HTML, browser);

    expect(pdf.length).toBeGreaterThan(500);
    expect(pdf.subarray(0, 5).toString('latin1')).toBe('%PDF-');
    // A well-formed PDF ends with the EOF marker.
    expect(pdf.subarray(-6).toString('latin1')).toContain('%%EOF');
  }, 20_000);

  it('leaves the caller-owned browser open', async () => {
    await renderPdfReport(HTML, browser);

    expect(browser.isConnected()).toBe(true);
  }, 20_000);
});
