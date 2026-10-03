import { fetchWithRetries } from './retry';

function response(status: number): Response {
  return { ok: status < 400, status } as Response;
}

describe('fetchWithRetries', () => {
  it('retries network errors, rate limiting, and server errors, waiting longer each time', async () => {
    const attempt = jest
      .fn()
      .mockRejectedValueOnce(new TypeError('fetch failed'))
      .mockResolvedValueOnce(response(429))
      .mockResolvedValueOnce(response(503))
      .mockResolvedValueOnce(response(200));
    const sleep = jest.fn().mockResolvedValue(undefined);

    expect(
      (await fetchWithRetries('https://example.com/a', attempt, sleep)).status,
    ).toEqual(200);
    expect(sleep.mock.calls).toEqual([[2000], [4000], [8000]]);
  });

  it('returns a success or a definite answer like not found without retrying', async () => {
    const attempt = jest
      .fn()
      .mockResolvedValueOnce(response(200))
      .mockResolvedValueOnce(response(404));

    expect(
      (
        await fetchWithRetries(
          'https://example.com/a',
          attempt,
          async () => undefined,
        )
      ).status,
    ).toEqual(200);
    expect(
      (
        await fetchWithRetries(
          'https://example.com/a',
          attempt,
          async () => undefined,
        )
      ).status,
    ).toEqual(404);
    expect(attempt).toHaveBeenCalledTimes(2);
  });

  it('names the url and the last failure after four attempts', async () => {
    const attempt = jest.fn().mockResolvedValue(response(503));

    await expect(
      fetchWithRetries('https://example.com/a', attempt, async () => undefined),
    ).rejects.toThrow(
      'GET https://example.com/a failed after 4 attempts: HTTP 503',
    );
    expect(attempt).toHaveBeenCalledTimes(4);
  });
});
