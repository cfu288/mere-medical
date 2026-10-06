import { createCrawlDelayedFetch, FETCH_TIMEOUT_MS } from './crawlDelayedFetch';

function okResponse(body: string): Response {
  return { ok: true, status: 200, text: async () => body } as Response;
}

describe('createCrawlDelayedFetch', () => {
  it('gives every request a timeout and honors the crawl delay of a host', async () => {
    const fetchImpl = jest
      .fn<Promise<Response>, [string, RequestInit | undefined]>()
      .mockResolvedValueOnce(okResponse('User-agent: *\nCrawl-delay: 2\n'))
      .mockResolvedValue(okResponse('page'));
    const sleep = jest.fn().mockResolvedValue(undefined);
    const crawlDelayedFetch = createCrawlDelayedFetch({
      fetchImpl,
      sleep,
      now: () => 1000,
    });

    await crawlDelayedFetch('https://example.org/a');
    await crawlDelayedFetch('https://example.org/b');

    expect(fetchImpl.mock.calls.map(([url]) => url)).toEqual([
      'https://example.org/robots.txt',
      'https://example.org/a',
      'https://example.org/b',
    ]);
    for (const [, init] of fetchImpl.mock.calls) {
      expect(init?.signal).toBeInstanceOf(AbortSignal);
    }
    expect(sleep.mock.calls).toEqual([[2000], [2000]]);
    expect(FETCH_TIMEOUT_MS).toEqual(120000);
  });
});
