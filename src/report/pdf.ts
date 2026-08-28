import type { Browser } from 'playwright';

/**
 * Renders the self-contained HTML report (see `render.ts`) to PDF bytes by
 * printing it in headless Chromium.
 *
 * Takes an already-launched browser and never closes it: the caller owns
 * the lifecycle, exactly as `scan` does. Chromium is the only engine
 * Playwright can print with; that is acceptable because it is already the
 * scanner's engine (ADR 0006). The HTML carries its own inline CSS and no
 * external assets, so `setContent` needs no network and no static server.
 */
export async function renderPdfReport(html: string, browser: Browser): Promise<Buffer> {
  const page = await browser.newPage();
  try {
    await page.setContent(html, { waitUntil: 'load' });
    return await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '16mm', bottom: '16mm', left: '14mm', right: '14mm' },
    });
  } finally {
    await page.close();
  }
}
