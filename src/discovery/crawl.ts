import { extractLinks, isCrawlableUrl, matchesExcludePattern } from './links.js';
import { fetchRobotsRules, isAllowedByRobots } from './robots.js';

export interface CrawlOptions {
  readonly baseUrl: string;
  readonly maxPages: number;
  readonly excludePaths?: readonly string[];
  /** Injectable for tests; defaults to the global fetch. */
  readonly fetchFn?: typeof fetch;
}

/**
 * Breadth-first fallback crawl, used when a site has no sitemap. Starts at
 * baseUrl, follows same-origin links in document order, and stops once
 * maxPages pages have been collected. robots.txt, the configured
 * excludePaths, and non-page assets (mailto:, PDFs, images, ...) are all
 * applied identically to the seed URL and to every discovered link, so a
 * disallowed or excluded home page yields zero results rather than being
 * scanned anyway.
 *
 * Deterministic: links are visited in a plain FIFO queue in the order they
 * appear in each page's HTML, so the same input always produces the same
 * page list in the same order.
 */
export async function crawlSite(options: CrawlOptions): Promise<string[]> {
  const { baseUrl, maxPages, excludePaths = [], fetchFn = fetch } = options;

  const origin = new URL(baseUrl).origin;
  const robotsRules = await fetchRobotsRules(origin, fetchFn);

  const isPermitted = (url: URL): boolean =>
    url.origin === origin &&
    isCrawlableUrl(url) &&
    !matchesExcludePattern(url.pathname, excludePaths) &&
    isAllowedByRobots(url.pathname + url.search, robotsRules);

  const startUrl = new URL(baseUrl);
  startUrl.hash = '';

  const queue: string[] = [];
  const seen = new Set<string>();
  const collected: string[] = [];

  if (isPermitted(startUrl)) {
    const startHref = startUrl.toString();
    queue.push(startHref);
    seen.add(startHref);
  }

  while (queue.length > 0 && collected.length < maxPages) {
    const currentUrl = queue.shift();
    if (currentUrl === undefined) {
      break;
    }

    const html = await fetchPage(fetchFn, currentUrl);
    if (html === null) {
      continue;
    }

    collected.push(currentUrl);
    if (collected.length >= maxPages) {
      break;
    }

    enqueueLinks(extractLinks(html, currentUrl), isPermitted, seen, queue);
  }

  return collected;
}

async function fetchPage(fetchFn: typeof fetch, url: string): Promise<string | null> {
  try {
    const response = await fetchFn(url);
    return response.ok ? await response.text() : null;
  } catch {
    return null;
  }
}

function enqueueLinks(
  hrefs: readonly string[],
  isPermitted: (url: URL) => boolean,
  seen: Set<string>,
  queue: string[],
): void {
  for (const href of hrefs) {
    let url: URL;
    try {
      url = new URL(href);
    } catch {
      continue;
    }
    url.hash = '';
    const normalized = url.toString();

    if (seen.has(normalized) || !isPermitted(url)) {
      continue;
    }
    seen.add(normalized);
    queue.push(normalized);
  }
}
