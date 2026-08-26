import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parseSitemapXml, SitemapError } from './sitemap.js';

const FIXTURES_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../../fixtures/sitemaps');

function readFixture(name: string): string {
  return readFileSync(resolve(FIXTURES_DIR, name), 'utf8');
}

describe('parseSitemapXml', () => {
  it('extracts every <loc> from a real urlset (anthropic.com/sitemap.xml, trimmed)', () => {
    const doc = parseSitemapXml(readFixture('urlset.xml'));

    expect(doc.kind).toBe('urlset');
    if (doc.kind !== 'urlset') {
      throw new Error('expected a urlset');
    }
    expect(doc.urls).toHaveLength(12);
    expect(doc.urls[0]).toBe('https://www.anthropic.com/');
    expect(doc.urls.every((url) => url.startsWith('https://www.anthropic.com/'))).toBe(true);
  });

  it('ignores <image:image> extensions nested under <url> (github.blog/post-sitemap.xml, trimmed)', () => {
    const doc = parseSitemapXml(readFixture('posts.xml'));

    expect(doc.kind).toBe('urlset');
    if (doc.kind !== 'urlset') {
      throw new Error('expected a urlset');
    }
    // 6 <url> entries, two of which also contain <image:image><image:loc>...
    // The image locs must not leak into the result.
    expect(doc.urls).toHaveLength(6);
    expect(doc.urls).not.toContain(
      'https://github.blog/wp-content/uploads/2015/06/brubeck-node-graph.png',
    );
    expect(doc.urls).toContain('https://github.blog/news-insights/the-library/brubeck/');
  });

  it('extracts sub-sitemap locations from a real sitemap index (github.blog/sitemap.xml)', () => {
    const doc = parseSitemapXml(readFixture('index.xml'));

    expect(doc.kind).toBe('sitemapindex');
    if (doc.kind !== 'sitemapindex') {
      throw new Error('expected a sitemapindex');
    }
    expect(doc.sitemaps).toHaveLength(17);
    expect(doc.sitemaps).toContain('https://github.blog/post-sitemap.xml');
    expect(doc.sitemaps.every((url) => url.startsWith('https://github.blog/'))).toBe(true);
  });

  it('rejects a document that is neither a urlset nor a sitemapindex', () => {
    expect(() => parseSitemapXml('<not-a-sitemap/>')).toThrow(SitemapError);
  });
});
