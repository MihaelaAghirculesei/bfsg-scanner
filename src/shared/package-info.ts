import { readFileSync } from 'node:fs';

export interface ToolInfo {
  readonly name: string;
  readonly version: string;
}

/**
 * The tool's own name and version, read once from the package manifest that
 * ships next to the compiled code. Used to stamp reports and to answer
 * `--version`.
 */
export function toolInfo(): ToolInfo {
  const pkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')) as {
    name?: string;
    version?: string;
  };
  return { name: pkg.name ?? 'bfsg-scanner', version: pkg.version ?? '0.0.0' };
}
