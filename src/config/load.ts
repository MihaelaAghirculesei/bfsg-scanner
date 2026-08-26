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

  const result = configSchema.safeParse(parsed);
  if (!result.success) {
    throw new ConfigError(formatIssues(path, result.error));
  }

  return result.data;
}

function formatIssues(path: string, error: z.ZodError): string {
  const lines = error.issues.map((issue) => {
    const field = issue.path.length > 0 ? issue.path.join('.') : '(root)';
    return `  - ${field}: ${issue.message}`;
  });
  return `Invalid config at "${path}":\n${lines.join('\n')}`;
}
