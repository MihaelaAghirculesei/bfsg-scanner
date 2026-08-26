import { describe, expect, it } from 'vitest';
import { extractLinks, isCrawlableUrl, matchesExcludePattern } from './links.js';

describe('extractLinks', () => {
  it('resolves relative, absolute, double- and single-quoted hrefs', () => {
    const html = `
      <a href="/about.html">About</a>
      <a href='contact.html'>Contact</a>
      <a class="x" href="https://example.de/other">Other</a>
      <a>no href here</a>
    `;

    expect(extractLinks(html, 'https://example.de/dir/page.html')).toEqual([
      'https://example.de/about.html',
      'https://example.de/dir/contact.html',
      'https://example.de/other',
    ]);
  });

  it('skips an href that fails to resolve', () => {
    expect(extractLinks('<a href="">empty</a>', 'https://example.de/')).toEqual([]);
  });
});

describe('isCrawlableUrl', () => {
  it.each([
    ['https://example.de/about', true],
    ['https://example.de/v1.2/page', true],
    ['https://example.de/report.pdf', false],
    ['https://example.de/logo.SVG', false],
    ['mailto:info@example.de', false],
    ['tel:+491234567', false],
    ['javascript:void(0)', false],
  ])('%s -> %s', (url, expected) => {
    expect(isCrawlableUrl(new URL(url))).toBe(expected);
  });
});

describe('matchesExcludePattern', () => {
  it('matches the exact path and anything nested under it', () => {
    expect(matchesExcludePattern('/impressum', ['/impressum'])).toBe(true);
    expect(matchesExcludePattern('/impressum/legal', ['/impressum'])).toBe(true);
    expect(matchesExcludePattern('/impressum-extra', ['/impressum'])).toBe(false);
  });

  it('supports a wildcard pattern', () => {
    expect(matchesExcludePattern('/wp-admin/edit.php', ['/wp-admin/*'])).toBe(true);
    expect(matchesExcludePattern('/wp-content/x', ['/wp-admin/*'])).toBe(false);
  });

  it('returns false when no pattern is configured', () => {
    expect(matchesExcludePattern('/anything', [])).toBe(false);
  });
});
