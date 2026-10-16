import { createRateLimitedFetch } from './fetchBytes';

describe('createRateLimitedFetch', () => {
  const realFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  it('waits out the crawl delay of a host and gives every request a timeout', async () => {
    const fetchImpl = jest
      .fn<Promise<Response>, [string, RequestInit | undefined]>()
      .mockResolvedValueOnce(new Response('User-agent: *\nCrawl-delay: 2\n'))
      .mockResolvedValueOnce(new Response('a'))
      .mockResolvedValueOnce(new Response('b'));
    const sleep = jest.fn().mockResolvedValue(undefined);
    globalThis.fetch = fetchImpl as unknown as typeof fetch;
    const fetchBytes = createRateLimitedFetch({
      sleep,
      now: () => 1000,
    });

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
    globalThis.fetch = fetchImpl as unknown as typeof fetch;
    const fetchBytes = createRateLimitedFetch({
      sleep,
      now: () => 1000,
    });

    expect(await fetchBytes('https://example.com/a')).toEqual(
      new TextEncoder().encode('page'),
    );
    expect(sleep.mock.calls).toEqual([[0], [2000], [4000], [8000]]);
  });

  it('retries a response whose body fails to arrive', async () => {
    const fetchImpl = jest
      .fn<Promise<Response>, [string, RequestInit | undefined]>()
      .mockResolvedValueOnce(new Response(null, { status: 404 }))
      .mockResolvedValueOnce(
        new Response(
          new ReadableStream({
            start(controller) {
              controller.error(new TypeError('terminated'));
            },
          }),
        ),
      )
      .mockResolvedValueOnce(new Response('page'));
    globalThis.fetch = fetchImpl as unknown as typeof fetch;
    const fetchBytes = createRateLimitedFetch({
      sleep: async () => undefined,
      now: () => 1000,
    });

    expect(await fetchBytes('https://example.com/a')).toEqual(
      new TextEncoder().encode('page'),
    );
  });

  it('treats a robots.txt whose body fails to arrive as no crawl delay', async () => {
    const fetchImpl = jest
      .fn<Promise<Response>, [string, RequestInit | undefined]>()
      .mockResolvedValueOnce(
        new Response(
          new ReadableStream({
            start(controller) {
              controller.error(new TypeError('terminated'));
            },
          }),
        ),
      )
      .mockResolvedValueOnce(new Response('page'));
    const sleep = jest.fn().mockResolvedValue(undefined);
    globalThis.fetch = fetchImpl as unknown as typeof fetch;
    const fetchBytes = createRateLimitedFetch({
      sleep,
      now: () => 1000,
    });

    expect(await fetchBytes('https://example.com/a')).toEqual(
      new TextEncoder().encode('page'),
    );
    expect(sleep.mock.calls).toEqual([[0]]);
  });

  it('fails on a 404 without retrying', async () => {
    const fetchImpl = jest
      .fn<Promise<Response>, [string, RequestInit | undefined]>()
      .mockResolvedValueOnce(new Response(null, { status: 404 }))
      .mockResolvedValueOnce(new Response(null, { status: 404 }));
    globalThis.fetch = fetchImpl as unknown as typeof fetch;
    const fetchBytes = createRateLimitedFetch({
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
    globalThis.fetch = fetchImpl as unknown as typeof fetch;
    const fetchBytes = createRateLimitedFetch({
      sleep: async () => undefined,
      now: () => 1000,
    });

    await expect(fetchBytes('https://example.com/a')).rejects.toThrow(
      'GET https://example.com/a failed after 4 attempts: HTTP 503',
    );
    expect(fetchImpl).toHaveBeenCalledTimes(5);
  });

  it('reads robots.txt once when two first requests to a host start together', async () => {
    const fetchImpl = jest
      .fn<Promise<Response>, [string, RequestInit | undefined]>()
      .mockImplementation(async (url) => new Response(url));
    globalThis.fetch = fetchImpl as unknown as typeof fetch;
    const fetchBytes = createRateLimitedFetch({
      sleep: async () => undefined,
      now: () => 1000,
    });

    await Promise.all([
      fetchBytes('https://example.org/a'),
      fetchBytes('https://example.org/b'),
    ]);
    expect(fetchImpl.mock.calls).toEqual([
      ['https://example.org/robots.txt', { signal: expect.any(AbortSignal) }],
      ['https://example.org/a', { signal: expect.any(AbortSignal) }],
      ['https://example.org/b', { signal: expect.any(AbortSignal) }],
    ]);
  });
});
