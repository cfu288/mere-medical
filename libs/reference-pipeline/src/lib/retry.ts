const ATTEMPTS = 4;
const FIRST_WAIT_MS = 2000;

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
