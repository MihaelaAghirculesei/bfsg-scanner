import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ConfigError, loadConfig } from './load.js';

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'bfsg-config-test-'));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

function writeConfig(contents: string): string {
  const path = join(dir, 'bfsg.config.yaml');
  writeFileSync(path, contents, 'utf8');
  return path;
}

describe('loadConfig', () => {
  it('applies defaults when only the required field is set', () => {
    const path = writeConfig('baseUrl: https://example.de\n');

    const config = loadConfig(path);

    expect(config).toEqual({
      baseUrl: 'https://example.de',
      maxPages: 50,
      wcagTags: ['wcag2a', 'wcag2aa', 'wcag21aa'],
      excludePaths: [],
      outputDir: 'reports',
      failOn: 'serious',
      reportLanguage: 'de',
    });
  });

  it('honours explicit overrides for every field', () => {
    const path = writeConfig(`
baseUrl: https://shop.example.de
maxPages: 10
wcagTags: [wcag2a]
excludePaths: ["/impressum", "/datenschutz"]
outputDir: out
failOn: critical
reportLanguage: en
`);

    const config = loadConfig(path);

    expect(config.maxPages).toBe(10);
    expect(config.wcagTags).toEqual(['wcag2a']);
    expect(config.excludePaths).toEqual(['/impressum', '/datenschutz']);
    expect(config.outputDir).toBe('out');
    expect(config.failOn).toBe('critical');
    expect(config.reportLanguage).toBe('en');
  });

  it('rejects a config missing the required baseUrl', () => {
    const path = writeConfig('maxPages: 10\n');

    expect(() => loadConfig(path)).toThrow(ConfigError);
    expect(() => loadConfig(path)).toThrow(/baseUrl/);
  });

  it('rejects a baseUrl that is not a valid URL', () => {
    const path = writeConfig('baseUrl: not-a-url\n');

    expect(() => loadConfig(path)).toThrow(/baseUrl/);
  });

  it('rejects an unknown field to catch typos early', () => {
    const path = writeConfig('baseUrl: https://example.de\nmaxPagse: 10\n');

    expect(() => loadConfig(path)).toThrow(ConfigError);
  });

  it('rejects malformed YAML with a readable message', () => {
    const path = writeConfig('baseUrl: [unclosed\n');

    expect(() => loadConfig(path)).toThrow(/YAML/);
  });

  it('rejects a path that does not exist', () => {
    const path = join(dir, 'missing.yaml');

    expect(() => loadConfig(path)).toThrow(ConfigError);
    expect(() => loadConfig(path)).toThrow(/Cannot read config file/);
  });
});
