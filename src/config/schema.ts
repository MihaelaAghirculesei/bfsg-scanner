import { z } from 'zod';

export const wcagTagSchema = z.enum(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']);

export const failOnSchema = z.enum(['critical', 'serious', 'moderate', 'minor']);

export const reportLanguageSchema = z.enum(['de', 'en']);

export const reportFormatSchema = z.enum(['json', 'html', 'pdf']);

/**
 * A bare origin (`https://example.com`, an optional trailing slash): the
 * part of a sitemap entry that gets swapped for baseUrl's origin. A path
 * would suggest prefix rewriting, which this does not do.
 */
const originSchema = z.url().refine(
  (value) => {
    const url = new URL(value);
    return url.pathname === '/' && url.search === '' && url.hash === '';
  },
  { message: 'Must be an origin, e.g. "https://example.com", with no path, query or fragment' },
);

export const configSchema = z.strictObject({
  baseUrl: z.url(),
  sitemapOrigin: originSchema.optional(),
  maxPages: z.number().int().positive().max(1000).default(50),
  settleMs: z.number().int().min(0).max(60_000).default(0),
  wcagTags: z.array(wcagTagSchema).min(1).default(['wcag2a', 'wcag2aa', 'wcag21aa']),
  excludePaths: z.array(z.string()).default([]),
  outputDir: z.string().min(1).default('reports'),
  failOn: failOnSchema.default('serious'),
  reportLanguage: reportLanguageSchema.default('de'),
  reportFormats: z.array(reportFormatSchema).min(1).default(['json', 'html', 'pdf']),
});

export type Config = z.infer<typeof configSchema>;
export type ReportFormat = z.infer<typeof reportFormatSchema>;
