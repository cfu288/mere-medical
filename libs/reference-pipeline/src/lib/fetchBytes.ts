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
 * - It retries a 429 or 5xx response, or a thrown error, up to 4 attempts in
 *   all. The waits between attempts are 2, 4 and 8 seconds.
 * - Call it one request at a time. Two first requests to a host at once both
 *   read robots.txt and do not wait for each other.
 *
 * @param options Optional. Each field defaults to the real implementation. Only
 * tests pass their own.
 * @param options.fetchImpl `(url: string, init?: RequestInit) => Promise<Response>`.
 * Defaults to the global `fetch`.
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
  fetchImpl = fetch,
  sleep = setTimeout,
  now = Date.now,
}: {
  fetchImpl?: (url: string, init?: RequestInit) => Promise<Response>;
  sleep?: (ms: number) => Promise<unknown>;
  now?: () => number;
} = {}): (url: string) => Promise<Uint8Array> {
  const hosts = new Map<string, HostTiming>();
  const fetchWithTimeout = (url: string) =>
    fetchImpl(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });

  const getHostCrawlDelay = async (origin: string): Promise<HostTiming> => {
    const cached = hosts.get(origin);
    if (cached) {
      return cached;
    }
    const robots = await fetchWithTimeout(`${origin}/robots.txt`).catch(
      () => null,
    );
    const delay = robots?.ok ? parseCrawlDelaySeconds(await robots.text()) : 0;
    const host = { delayMs: delay * 1000, lastRequestAt: now() };
    hosts.set(origin, host);
    return host;
  };

  return async (url) => {
    const host = await getHostCrawlDelay(new URL(url).origin);
    let failure = '';
    for (let n = 1; n <= ATTEMPTS; n++) {
      if (n > 1) {
        await sleep(FIRST_RETRY_WAIT_MS * 2 ** (n - 2));
      }
      await sleep(Math.max(0, host.lastRequestAt + host.delayMs - now()));
      host.lastRequestAt = now();
      let response: Response;
      try {
        response = await fetchWithTimeout(url);
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
      return new Uint8Array(await response.arrayBuffer());
    }
    throw new Error(`GET ${url} failed after ${ATTEMPTS} attempts: ${failure}`);
  };
}
