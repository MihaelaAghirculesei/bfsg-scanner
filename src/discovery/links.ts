const NON_PAGE_EXTENSIONS: ReadonlySet<string> = new Set([
  '.pdf',
  '.jpg',
  '.jpeg',
  '.png',
  '.gif',
  '.svg',
  '.webp',
  '.ico',
  '.css',
  '.js',
  '.mjs',
  '.json',
  '.xml',
  '.zip',
  '.mp4',
  '.mp3',
  '.woff',
  '.woff2',
  '.ttf',
  '.eot',
  '.doc',
  '.docx',
  '.xls',
  '.xlsx',
]);

const HREF_PATTERN = /<a\s[^>]*?href\s*=\s*("([^"]*)"|'([^']*)')/gi;

/** Extracts every <a href> from raw HTML, resolved against pageUrl. Href
 * values that fail to resolve (empty, malformed) are silently skipped —
 * this is a best-effort fallback crawler, not an HTML validator. */
export function extractLinks(html: string, pageUrl: string): string[] {
  const links: string[] = [];
  for (const match of html.matchAll(HREF_PATTERN)) {
    const raw = match[2] ?? match[3] ?? '';
    if (raw.length === 0) {
      continue;
    }
    try {
      links.push(new URL(raw, pageUrl).toString());
    } catch {
      // ignore unparsable hrefs
    }
  }
  return links;
}

/** True for http(s) links that don't point at a known non-page asset.
 * Rejects mailto:/tel:/javascript: via the protocol check. */
export function isCrawlableUrl(url: URL): boolean {
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return false;
  }
  const lastSegment = url.pathname.slice(url.pathname.lastIndexOf('/') + 1);
  const lastDot = lastSegment.lastIndexOf('.');
  if (lastDot === -1) {
    return true;
  }
  return !NON_PAGE_EXTENSIONS.has(lastSegment.slice(lastDot).toLowerCase());
}

/** Simple glob matching against a URL pathname: `*` matches any sequence of
 * characters, and a pattern with no trailing wildcard also matches
 * everything under it (e.g. "/impressum" matches "/impressum/legal"). */
export function matchesExcludePattern(pathname: string, patterns: readonly string[]): boolean {
  return patterns.some((pattern) => {
    const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
    return new RegExp(`^${escaped}(?:/.*)?$`).test(pathname);
  });
}
