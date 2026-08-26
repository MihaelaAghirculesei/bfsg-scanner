import { XMLParser } from 'fast-xml-parser';

export class SitemapError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SitemapError';
  }
}

export type SitemapDocument =
  | { readonly kind: 'urlset'; readonly urls: readonly string[] }
  | { readonly kind: 'sitemapindex'; readonly sitemaps: readonly string[] };

const parser = new XMLParser({ ignoreAttributes: true });

/**
 * Parses a sitemaps.org XML document (urlset or sitemapindex), extracting
 * only each entry's own <loc>. Extensions nested under a <url> — most
 * commonly <image:image><image:loc>...</image:loc></image:image> in
 * WordPress-generated sitemaps — are deliberately ignored: they share the
 * tag name "loc" but are not page URLs.
 */
export function parseSitemapXml(xml: string): SitemapDocument {
  const doc = parser.parse(xml) as Record<string, unknown>;

  if (isRecord(doc.urlset)) {
    return { kind: 'urlset', urls: extractLocs(doc.urlset.url) };
  }

  if (isRecord(doc.sitemapindex)) {
    return { kind: 'sitemapindex', sitemaps: extractLocs(doc.sitemapindex.sitemap) };
  }

  throw new SitemapError('Expected a <urlset> or <sitemapindex> root element');
}

function extractLocs(entries: unknown): string[] {
  const list = Array.isArray(entries) ? entries : entries === undefined ? [] : [entries];
  return list
    .filter(isRecord)
    .map((entry) => entry.loc)
    .filter((loc): loc is string => typeof loc === 'string');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
