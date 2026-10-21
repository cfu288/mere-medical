import { setTimeout } from 'timers/promises';

import { parseCrawlDelaySeconds } from './robots';

const ATTEMPTS = 4;
const FIRST_RETRY_WAIT_MS = 2000;
const FETCH_TIMEOUT_MS = 120_000;

type HostTiming = { delayMs: number; lastRequestAt: number };

/**
 * Returns the fetch function that `buildReferenceLibrary` uses for every
 * request. The CLI creates one for each run.
 *
 * Before its first request to an origin, such as `https://www.cdc.gov`, it
 * reads that origin's robots.txt. It then waits the crawl delay between the
 * starts of requests to that origin. A missing or unreadable robots.txt sets no delay. It
 * does not read `Disallow` rules.
 *
 * It does not delay requests made at the same time. `buildReferenceLibrary`
 * makes only one request at a time.
 *
 * @param options Optional. Tests use it to replace `sleep` and `now`.
 * @returns `(url: string) => Promise<Uint8Array>`. Resolves with the body of a
 * 2xx response. It does not detect bot check pages.
 * @throws `Error` "GET <url> failed after 4 attempts: <last failure>" when
 * every attempt returns a 429 or 5xx or throws.
 * @throws `Error` "GET <url> returned <status>" right away for any other failed
 * status, such as 404.
 *
 * @example
 * // https://example.org/robots.txt has "User-agent: *" and "Crawl-delay: 5".
 * const fetchBytes = createRateLimitedFetch();
 * await fetchBytes('https://example.org/a'); // waits 5 s after reading robots.txt
 * await fetchBytes('https://example.org/b'); // starts 5 s after the first request started
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
