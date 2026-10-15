/**
 * Reads the crawl delay that a robots.txt sets for all user agents.
 *
 * Only a `Crawl-delay` in a group whose `User-agent` lines include `*` counts.
 * The fetch sends Node's default user agent. Only `*` applies to it.
 * It ignores comments after `#` and matches keys in any case.
 *
 * @param robotsTxt `string`. The body of a robots.txt file.
 * @returns `number`. The delay in seconds, or 0 when there is none or it is
 * not a positive number.
 *
 * @example
 * parseCrawlDelaySeconds('User-agent: *\nCrawl-delay: 5\n');
 * // 5
 */
export function parseCrawlDelaySeconds(robotsTxt: string): number {
  let agents: string[] = [];
  let inRules = false;
  for (const raw of robotsTxt.split('\n')) {
    const line = raw.replace(/#.*/, '').trim();
    const colon = line.indexOf(':');
    if (colon === -1) {
      continue;
    }
    const key = line.slice(0, colon).trim().toLowerCase();
    const value = line.slice(colon + 1).trim();
    if (key === 'user-agent') {
      agents = inRules ? [value] : [...agents, value];
      inRules = false;
    } else {
      inRules = true;
      if (key === 'crawl-delay' && agents.includes('*')) {
        const seconds = Number(value);
        return Number.isFinite(seconds) && seconds > 0 ? seconds : 0;
      }
    }
  }
  return 0;
}
