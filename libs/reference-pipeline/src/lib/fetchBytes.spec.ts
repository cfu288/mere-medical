import { createFetchBytes } from './fetchBytes';

describe('createFetchBytes', () => {
  it('waits out the crawl delay of a host and gives every request a timeout', async () => {
    const fetchImpl = jest
      .fn<Promise<Response>, [string, RequestInit | undefined]>()
      .mockResolvedValueOnce(new Response('User-agent: *\nCrawl-delay: 2\n'))
      .mockResolvedValueOnce(new Response('a'))
      .mockResolvedValueOnce(new Response('b'));
    const sleep = jest.fn().mockResolvedValue(undefined);
    const fetchBytes = createFetchBytes({ fetchImpl, sleep, now: () => 1000 });

    expect([
      await fetchBytes('https://example.org/a'),
      await fetchBytes('https://example.org/b'),
    ]).toEqual([new TextEncoder().encode('a'), new TextEncoder().encode('b')]);
    expect(fetchImpl.mock.calls).toEqual([
      ['https://example.org/robots.txt', { signal: expect.any(AbortSignal) }],
      ['https://example.org/a', { signal: expect.any(AbortSignal) }],
      ['https://example.org/b', { signal: expect.any(AbortSignal) }],
    ]);
    expect(sleep.mock.calls).toEqual([[2000], [2000]]);
  });

  it('retries network errors, rate limiting and server errors, waiting longer each time', async () => {
    const fetchImpl = jest
      .fn<Promise<Response>, [string, RequestInit | undefined]>()
      .mockResolvedValueOnce(new Response(null, { status: 404 }))
      .mockRejectedValueOnce(new TypeError('fetch failed'))
      .mockResolvedValueOnce(new Response(null, { status: 429 }))
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(new Response('page'));
    const sleep = jest.fn().mockResolvedValue(undefined);
    const fetchBytes = createFetchBytes({ fetchImpl, sleep, now: () => 1000 });

    expect(await fetchBytes('https://example.com/a')).toEqual(
      new TextEncoder().encode('page'),
    );
    expect(sleep.mock.calls).toEqual([
      [0],
      [2000],
      [0],
      [4000],
      [0],
      [8000],
      [0],
    ]);
  });

  it('fails on a definite answer like not found without retrying', async () => {
    const fetchImpl = jest
      .fn<Promise<Response>, [string, RequestInit | undefined]>()
      .mockResolvedValueOnce(new Response(null, { status: 404 }))
      .mockResolvedValueOnce(new Response(null, { status: 404 }));
    const fetchBytes = createFetchBytes({
      fetchImpl,
      sleep: async () => undefined,
      now: () => 1000,
    });

    await expect(fetchBytes('https://example.com/a')).rejects.toThrow(
      'GET https://example.com/a returned 404',
    );
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('names the url and the last failure after four attempts', async () => {
    const fetchImpl = jest
      .fn<Promise<Response>, [string, RequestInit | undefined]>()
      .mockResolvedValueOnce(new Response(null, { status: 404 }))
      .mockResolvedValue(new Response(null, { status: 503 }));
    const fetchBytes = createFetchBytes({
      fetchImpl,
      sleep: async () => undefined,
      now: () => 1000,
    });

    await expect(fetchBytes('https://example.com/a')).rejects.toThrow(
      'GET https://example.com/a failed after 4 attempts: HTTP 503',
    );
    expect(fetchImpl).toHaveBeenCalledTimes(5);
  });
});
