/**
 * Reads the crawl delay that a robots.txt sets for all user agents.
 *
 * Only a `Crawl-delay` in a group whose `User-agent` lines include `*` counts.
 * Node's fetch sends the user agent `node`, which only `*` matches here.
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
  let groupIsForAll = false;
  let groupHasRules = false;
  for (const raw of robotsTxt.split('\n')) {
    const line = raw.replace(/#.*/, '').trim();
    const colon = line.indexOf(':');
    if (colon === -1) {
      continue;
    }
    const key = line.slice(0, colon).trim().toLowerCase();
    const value = line.slice(colon + 1).trim();
    if (key === 'user-agent') {
      groupIsForAll = (!groupHasRules && groupIsForAll) || value === '*';
      groupHasRules = false;
    } else {
      groupHasRules = true;
      if (key === 'crawl-delay' && groupIsForAll) {
        const seconds = Number(value);
        return Number.isFinite(seconds) && seconds > 0 ? seconds : 0;
      }
    }
  }
  return 0;
}
