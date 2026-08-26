/**
 * Sent on every request the scanner makes — Playwright navigations and the
 * plain fetch() calls used for sitemap/robots.txt/crawl discovery — so a
 * site operator can identify, and if they choose, block traffic from this
 * tool. Never omit it and never spoof a real browser's User-Agent.
 */
export const USER_AGENT = 'bfsg-scanner (+https://github.com/MihaelaAghirculesei/bfsg-scanner)';

/** Default fetch for discovery (sitemap/robots.txt/crawl): identical to the
 * global fetch, but always carries USER_AGENT. Tests inject their own
 * fetchFn and bypass this. */
export const fetchWithUserAgent: typeof fetch = (input, init) =>
  fetch(input, { ...init, headers: { ...init?.headers, 'User-Agent': USER_AGENT } });
