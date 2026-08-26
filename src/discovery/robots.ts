import { fetchWithUserAgent } from '../shared/user-agent.js';

export interface RobotsRule {
  readonly pattern: string;
  readonly allow: boolean;
}

/**
 * Parses the rule group matching `userAgent` (default "*") out of a
 * robots.txt file. Only Allow/Disallow/User-agent are recognised — Sitemap,
 * Crawl-delay, and anything else are ignored, since this parser exists only
 * to decide whether a URL may be crawled.
 */
export function parseRobotsTxt(text: string, userAgent = '*'): readonly RobotsRule[] {
  const lines = stripBom(text).split(/\r?\n/);
  const groups: { agents: string[]; rules: RobotsRule[] }[] = [];
  let current: { agents: string[]; rules: RobotsRule[] } | null = null;

  for (const rawLine of lines) {
    const line = stripComment(rawLine).trim();
    if (line.length === 0) {
      continue;
    }

    const separatorIndex = line.indexOf(':');
    if (separatorIndex === -1) {
      continue;
    }

    const directive = line.slice(0, separatorIndex).trim().toLowerCase();
    const value = line.slice(separatorIndex + 1).trim();

    if (directive === 'user-agent') {
      // A fresh User-agent line after rules have already been recorded
      // starts a new group; consecutive User-agent lines with no rules yet
      // belong to the same group (robots.txt allows grouping agents).
      if (current === null || current.rules.length > 0) {
        current = { agents: [], rules: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
    } else if (directive === 'allow' || directive === 'disallow') {
      if (current === null || (directive === 'disallow' && value.length === 0)) {
        continue;
      }
      current.rules.push({ pattern: value, allow: directive === 'allow' });
    }
  }

  const group = groups.find((g) => g.agents.includes(userAgent.toLowerCase()));
  return group?.rules ?? [];
}

/**
 * Standard robots.txt precedence: the most specific (longest) matching
 * pattern wins; an Allow breaks a tie with a Disallow of equal length.
 * With no matching rule, the path is allowed by default.
 */
export function isAllowedByRobots(pathAndQuery: string, rules: readonly RobotsRule[]): boolean {
  let best: RobotsRule | null = null;
  for (const rule of rules) {
    if (!matchesRobotsPattern(pathAndQuery, rule.pattern)) {
      continue;
    }
    if (
      best === null ||
      rule.pattern.length > best.pattern.length ||
      (rule.pattern.length === best.pattern.length && rule.allow && !best.allow)
    ) {
      best = rule;
    }
  }
  return best === null || best.allow;
}

export async function fetchRobotsRules(
  origin: string,
  fetchFn: typeof fetch = fetchWithUserAgent,
): Promise<readonly RobotsRule[]> {
  try {
    const response = await fetchFn(new URL('/robots.txt', origin).toString());
    if (!response.ok) {
      return [];
    }
    return parseRobotsTxt(await response.text());
  } catch {
    return [];
  }
}

function matchesRobotsPattern(pathAndQuery: string, pattern: string): boolean {
  if (pattern.length === 0) {
    return false;
  }
  const endsWithDollar = pattern.endsWith('$');
  const body = endsWithDollar ? pattern.slice(0, -1) : pattern;
  const escaped = body.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
  const regex = new RegExp(`^${escaped}${endsWithDollar ? '$' : ''}`);
  return regex.test(pathAndQuery);
}

function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

function stripComment(line: string): string {
  const hashIndex = line.indexOf('#');
  return hashIndex === -1 ? line : line.slice(0, hashIndex);
}
