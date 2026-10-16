import { setTimeout } from 'timers/promises';

import { parseCrawlDelaySeconds } from './robots';

const ATTEMPTS = 4;
const FIRST_RETRY_WAIT_MS = 2000;
const FETCH_TIMEOUT_MS = 120_000;

type HostTiming = { delayMs: number; lastRequestAt: number };

/**
 * Makes a fetch that waits between requests to each host as its robots.txt
 * asks, and returns the body.
 *
 * - On the first request to a host it reads that host's robots.txt once. A
 *   `Crawl-delay` for all user agents (`User-agent: *`) sets the wait between
 *   requests to that host. A missing or unreadable robots.txt means no wait.
 *   It reads only `Crawl-delay`, not `Disallow`.
 * - Each request waits until the host's delay passes after its last request,
 *   robots.txt included.
 * - It abandons a request after 120 seconds.
 * - It retries a 429 or 5xx response, a failed request or a body that fails to
 *   arrive, up to 4 attempts in all. The waits between attempts are 2, 4 and 8
 *   seconds, or the crawl delay when it is longer.
 * - Requests that start together share one read of a host's robots.txt.
 *
 * @param options Optional. Each field defaults to the real implementation. Only
 * tests pass their own.
 * @param options.sleep `(ms: number) => Promise<unknown>`. Defaults to
 * `setTimeout` from `timers/promises`.
 * @param options.now `() => number`, the time in milliseconds. Defaults to
 * `Date.now`.
 * @returns `(url: string) => Promise<Uint8Array>`. Resolves with the body of a
 * 2xx response.
 * @throws `Error` "GET <url> returned <status>" for any other status below 500
 * except 429, such as 404, with no retry.
 * @throws `Error` "GET <url> failed after 4 attempts: <last failure>" when
 * every attempt returns a 429 or 5xx or throws.
 *
 * @example
 * // https://example.org/robots.txt has "User-agent: *" and "Crawl-delay: 5".
 * const fetchBytes = createRateLimitedFetch();
 * await fetchBytes('https://example.org/a'); // waits 5 s after reading robots.txt
 * await fetchBytes('https://example.org/b'); // waits 5 s after the first request
 */
export function createRateLimitedFetch({
  sleep = setTimeout,
  now = Date.now,
}: {
  sleep?: (ms: number) => Promise<unknown>;
  now?: () => number;
} = {}): (url: string) => Promise<Uint8Array> {
  const hosts = new Map<string, Promise<HostTiming>>();
  const fetchWithTimeout = (url: string) =>
    fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });

  const readHostTiming = async (origin: string): Promise<HostTiming> => {
    const robotsTxt = await fetchWithTimeout(`${origin}/robots.txt`)
      .then((response) => (response.ok ? response.text() : ''))
      .catch(() => '');
    return {
      delayMs: parseCrawlDelaySeconds(robotsTxt) * 1000,
      lastRequestAt: now(),
    };
  };
  const getHostTiming = (origin: string): Promise<HostTiming> => {
    const cached = hosts.get(origin);
    if (cached) {
      return cached;
    }
    const timing = readHostTiming(origin);
    hosts.set(origin, timing);
    return timing;
  };

  return async (url) => {
    const host = await getHostTiming(new URL(url).origin);
    let failure = '';
    for (let n = 1; n <= ATTEMPTS; n++) {
      const retryWait = n > 1 ? FIRST_RETRY_WAIT_MS * 2 ** (n - 2) : 0;
      const crawlWait = host.lastRequestAt + host.delayMs - now();
      await sleep(Math.max(0, retryWait, crawlWait));
      host.lastRequestAt = now();
      let response: Response;
      let body: Uint8Array;
      try {
        response = await fetchWithTimeout(url);
        body = await response.bytes();
      } catch (e) {
        failure = e instanceof Error ? e.message : String(e);
        continue;
      }
      if (response.status === 429 || response.status >= 500) {
        failure = `HTTP ${response.status}`;
        continue;
      }
      if (!response.ok) {
        throw new Error(`GET ${url} returned ${response.status}`);
      }
      return body;
    }
    throw new Error(`GET ${url} failed after ${ATTEMPTS} attempts: ${failure}`);
  };
}
