import { setTimeout } from 'timers/promises';

import { fetchWithRetries } from './retry';
import { crawlDelaySeconds } from './robots';

const FETCH_TIMEOUT_MS = 120_000;

type Host = { delayMs: number; lastRequestAt: number };

/**
 * Makes a fetch that is polite to each host it visits.
 *
 * - On the first request to a host it reads that host's robots.txt once. A
 *   `Crawl-delay` for all user agents (`User-agent: *`) sets the wait between
 *   requests to that host. A missing or unreadable robots.txt means no wait.
 * - Each request waits until the host's delay has passed since its last
 *   request, robots.txt included.
 * - A request is given up after 120 seconds.
 * - A 429 or 5xx response, or a thrown error, is retried by
 *   {@link fetchWithRetries}.
 *
 * @param options Optional. Each field defaults to the real implementation and
 * is replaced only in tests.
 * @param options.fetchImpl `(url: string, init?: RequestInit) => Promise<Response>`.
 * Defaults to the global `fetch`.
 * @param options.sleep `(ms: number) => Promise<unknown>`. Defaults to
 * `setTimeout` from `timers/promises`.
 * @param options.now `() => number`, the time in milliseconds. Defaults to
 * `Date.now`.
 * @returns `(url: string) => Promise<Response>`. Resolves with the first
 * response that is not a 429 or 5xx, which can still be a 4xx. Rejects when
 * every attempt fails.
 *
 * @example
 * // https://example.org/robots.txt has "User-agent: *" and "Crawl-delay: 5".
 * const crawlDelayedFetch = createCrawlDelayedFetch();
 * await crawlDelayedFetch('https://example.org/a'); // waits 5 s after reading robots.txt
 * await crawlDelayedFetch('https://example.org/b'); // waits 5 s after the first request
 */
export function createCrawlDelayedFetch({
  fetchImpl = fetch,
  sleep = setTimeout,
  now = Date.now,
}: {
  fetchImpl?: (url: string, init?: RequestInit) => Promise<Response>;
  sleep?: (ms: number) => Promise<unknown>;
  now?: () => number;
} = {}): (url: string) => Promise<Response> {
  const hosts = new Map<string, Host>();
  const timed = (url: string) =>
    fetchImpl(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  return async (url) => {
    const { origin } = new URL(url);
    let host = hosts.get(origin);
    if (!host) {
      const robots = await timed(`${origin}/robots.txt`).catch(() => null);
      const delay = robots?.ok ? crawlDelaySeconds(await robots.text()) : 0;
      host = { delayMs: delay * 1000, lastRequestAt: now() };
      hosts.set(origin, host);
    }
    const current = host;
    return fetchWithRetries(
      url,
      async () => {
        await sleep(
          Math.max(0, current.lastRequestAt + current.delayMs - now()),
        );
        current.lastRequestAt = now();
        return timed(url);
      },
      sleep,
    );
  };
}
