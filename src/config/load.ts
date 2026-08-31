import { readFileSync } from 'node:fs';
import { parse as parseYaml } from 'yaml';
import type { z } from 'zod';
import { type Config, configSchema } from './schema.js';

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}

/**
 * Validates an already-parsed config object against the schema, applying
 * defaults. Throws {@link ConfigError} with all issues listed on failure.
 * `source` names where the object came from, for the error message
 * (e.g. a quoted file path, or "command-line arguments").
 */
export function parseConfig(raw: unknown, source: string): Config {
  const result = configSchema.safeParse(raw);
  if (!result.success) {
    throw new ConfigError(formatIssues(source, result.error));
  }
  return result.data;
}

export function loadConfig(path: string): Config {
  let raw: string;
  try {
    raw = readFileSync(path, 'utf8');
  } catch (cause) {
    throw new ConfigError(`Cannot read config file at "${path}": ${(cause as Error).message}`);
  }

  let parsed: unknown;
  try {
    parsed = parseYaml(raw);
  } catch (cause) {
    throw new ConfigError(`Cannot parse "${path}" as YAML: ${(cause as Error).message}`);
  }

  return parseConfig(parsed, `"${path}"`);
}

function formatIssues(source: string, error: z.ZodError): string {
  const lines = error.issues.map((issue) => {
    const field = issue.path.length > 0 ? issue.path.join('.') : '(root)';
    return `  - ${field}: ${issue.message}`;
  });
  return `Invalid config (${source}):\n${lines.join('\n')}`;
}
