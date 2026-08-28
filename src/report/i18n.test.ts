import { describe, expect, it } from 'vitest';
import { type Locale, messagesFor } from './i18n.js';

const LOCALES: Locale[] = ['de', 'en'];

describe('messagesFor', () => {
  it('exposes the same keys for every locale', () => {
    const keySets = LOCALES.map((locale) => Object.keys(messagesFor(locale)).sort());
    for (const keys of keySets) {
      expect(keys).toEqual(keySets[0]);
    }
    expect(keySets[0]?.length ?? 0).toBeGreaterThan(0);
  });

  it('has no blank strings in any locale', () => {
    for (const locale of LOCALES) {
      for (const [key, value] of Object.entries(messagesFor(locale))) {
        expect(value.trim(), `${locale}.${key}`).not.toBe('');
      }
    }
  });

  it('returns a different table per locale', () => {
    expect(messagesFor('de')).not.toEqual(messagesFor('en'));
  });
});
