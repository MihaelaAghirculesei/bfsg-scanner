import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { isAllowedByRobots, parseRobotsTxt } from './robots.js';

const FIXTURE_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../fixtures/robots/wikipedia-robots.txt',
);

describe('parseRobotsTxt + isAllowedByRobots (real en.wikipedia.org/robots.txt, trimmed)', () => {
  const rules = parseRobotsTxt(readFileSync(FIXTURE_PATH, 'utf8'));

  it('does not pick up rules from an unrelated agent group (MJ12bot)', () => {
    // MJ12bot's group disallows everything; if groups were merged instead
    // of matched by agent, this would incorrectly come back false.
    expect(isAllowedByRobots('/wiki/Some_Article', rules)).toBe(true);
  });

  it('lets the longer, more specific Allow win over a shorter Disallow', () => {
    // Real published rule: "Disallow: /w/" vs "Allow: /w/api.php?action=mobileview&".
    expect(isAllowedByRobots('/w/api.php?action=mobileview&format=json', rules)).toBe(true);
  });

  it('still disallows paths under /w/ that no Allow rule covers', () => {
    expect(isAllowedByRobots('/w/index.php', rules)).toBe(false);
  });

  it('disallows an exact-prefix Disallow rule', () => {
    expect(isAllowedByRobots('/wiki/Special:Search', rules)).toBe(false);
  });

  it('allows a path matched by no rule', () => {
    expect(isAllowedByRobots('/wiki/Accessibility', rules)).toBe(true);
  });
});

describe('parseRobotsTxt', () => {
  it('treats an empty Disallow value as "allow everything"', () => {
    const rules = parseRobotsTxt('User-agent: *\nDisallow:\n');

    expect(isAllowedByRobots('/anything', rules)).toBe(true);
  });

  it('returns no rules when the requested user agent has no group', () => {
    const rules = parseRobotsTxt('User-agent: SomeBot\nDisallow: /\n', '*');

    expect(rules).toEqual([]);
  });
});
