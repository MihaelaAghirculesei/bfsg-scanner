import { ConfigError, loadConfig } from '../config/index.js';

const DEFAULT_CONFIG_PATH = 'bfsg.config.yaml';

export function parseArgs(argv: readonly string[]): { configPath: string } {
  const flagIndex = argv.indexOf('--config');
  if (flagIndex === -1) {
    return { configPath: DEFAULT_CONFIG_PATH };
  }

  const configPath = argv[flagIndex + 1];
  if (!configPath) {
    throw new ConfigError('--config flag requires a path argument');
  }

  return { configPath };
}

export function run(argv: readonly string[]): number {
  let configPath: string;
  try {
    ({ configPath } = parseArgs(argv));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    return 2;
  }

  try {
    const config = loadConfig(configPath);
    console.log(`Config OK: ${config.baseUrl}`);
    return 0;
  } catch (error) {
    if (error instanceof ConfigError) {
      console.error(error.message);
      return 2;
    }
    throw error;
  }
}
