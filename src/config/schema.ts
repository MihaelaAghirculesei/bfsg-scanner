import { z } from 'zod';

const wcagTagSchema = z.enum(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']);

const failOnSchema = z.enum(['critical', 'serious', 'moderate', 'minor']);

const reportLanguageSchema = z.enum(['de', 'en']);

export const configSchema = z.strictObject({
  baseUrl: z.url(),
  maxPages: z.number().int().positive().max(1000).default(50),
  wcagTags: z.array(wcagTagSchema).min(1).default(['wcag2a', 'wcag2aa', 'wcag21aa']),
  excludePaths: z.array(z.string()).default([]),
  outputDir: z.string().min(1).default('reports'),
  failOn: failOnSchema.default('serious'),
  reportLanguage: reportLanguageSchema.default('de'),
});

export type Config = z.infer<typeof configSchema>;
