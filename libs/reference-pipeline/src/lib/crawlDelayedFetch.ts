import { fetchWithRetries } from './retry';
import { crawlDelaySeconds } from './robots';

const FETCH_TIMEOUT_MS = 120_000;

type Host = { delayMs: number; lastRequestAt: number };

/** A fetch that reads each host's robots.txt once, waits out its crawl delay, retries, and gives up on any request after FETCH_TIMEOUT_MS. */
export function createCrawlDelayedFetch({
  fetchImpl,
  sleep,
  now,
}: {
  fetchImpl: (url: string, init?: RequestInit) => Promise<Response>;
  sleep: (ms: number) => Promise<unknown>;
  now: () => number;
}): (url: string) => Promise<Response> {
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
