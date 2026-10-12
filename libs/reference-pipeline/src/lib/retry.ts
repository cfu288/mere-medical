const ATTEMPTS = 4;
const FIRST_WAIT_MS = 2000;

/**
 * Runs `attempt` up to 4 times until it returns a response that is not a 429
 * or 5xx. The waits between attempts are 2, 4 and 8 seconds.
 *
 * @param url `string`. Used only in the error message.
 * @param attempt `() => Promise<Response>`. Makes one request.
 * @param sleep `(ms: number) => Promise<unknown>`. Waits between attempts.
 * @returns `Promise<Response>`. The first response with a status below 500
 * other than 429. A 4xx such as 404 is returned, not retried. A `Retry-After`
 * header is ignored.
 * @throws `Error` "GET <url> failed after 4 attempts: <last failure>" when
 * every attempt returns a 429 or 5xx or throws.
 *
 * @example
 * import { setTimeout } from 'timers/promises';
 *
 * const response = await fetchWithRetries(
 *   'https://example.com',
 *   () => fetch('https://example.com'),
 *   setTimeout,
 * );
 * // A 503 then a 200 resolves with the 200 response after a 2 s wait.
 * // Four 503s reject with "GET https://example.com failed after 4 attempts: HTTP 503".
 */
export async function fetchWithRetries(
  url: string,
  attempt: () => Promise<Response>,
  sleep: (ms: number) => Promise<unknown>,
): Promise<Response> {
  let failure = '';
  for (let n = 1; n <= ATTEMPTS; n++) {
    if (n > 1) {
      await sleep(FIRST_WAIT_MS * 2 ** (n - 2));
    }
    try {
      const response = await attempt();
      if (response.status !== 429 && response.status < 500) {
        return response;
      }
      failure = `HTTP ${response.status}`;
    } catch (e) {
      failure = e instanceof Error ? e.message : String(e);
    }
  }
  throw new Error(`GET ${url} failed after ${ATTEMPTS} attempts: ${failure}`);
}
