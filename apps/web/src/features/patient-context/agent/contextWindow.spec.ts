import {
  detectContextWindow,
  fitsWithAnswer,
  measureBudget,
} from './contextWindow';

function jsonResponse(body: unknown, status = 200): Response {
  return { ok: status < 400, status, json: async () => body } as Response;
}

describe('detectContextWindow', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("reads an openai-compatible server's max_model_len for the model", async () => {
    global.fetch = jest.fn().mockResolvedValue(
      jsonResponse({
        data: [
          { id: 'other-model', max_model_len: 8192 },
          { id: 'qwen-27b', max_model_len: 49152 },
        ],
      }),
    );

    expect(
      await detectContextWindow({
        endpoint: 'http://gpu:8000/v1',
        model: 'qwen-27b',
        apiKey: 'secret',
      }),
    ).toEqual(49152);
    expect(global.fetch).toHaveBeenCalledWith('http://gpu:8000/v1/models', {
      headers: { Accept: 'application/json', Authorization: 'Bearer secret' },
      signal: expect.any(AbortSignal),
    });
  });

  it("reads the context length of ollama's loaded model", async () => {
    global.fetch = jest.fn().mockResolvedValue(
      jsonResponse({
        models: [{ name: 'qwen3.5:latest', context_length: 16384 }],
      }),
    );

    expect(
      await detectContextWindow({
        endpoint: 'http://localhost:11434',
        model: 'qwen3.5:latest',
      }),
    ).toEqual(16384);
    expect(global.fetch).toHaveBeenCalledWith('http://localhost:11434/api/ps', {
      headers: { Accept: 'application/json' },
      signal: expect.any(AbortSignal),
    });
  });

  it('is unknown when the server does not report a window for the model', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(jsonResponse({ data: [{ id: 'qwen-27b' }] }));

    expect(
      await detectContextWindow({
        endpoint: 'http://gpu:8000/v1',
        model: 'qwen-27b',
      }),
    ).toEqual(null);
  });

  it('is unknown when the ollama model is not loaded', async () => {
    global.fetch = jest.fn().mockResolvedValue(jsonResponse({ models: [] }));

    expect(
      await detectContextWindow({
        endpoint: 'http://localhost:11434',
        model: 'qwen3.5:latest',
      }),
    ).toEqual(null);
  });

  it('gives up on a server that never answers once the timeout passes', async () => {
    jest.useFakeTimers();
    global.fetch = jest.fn(
      (_url: string, init?: RequestInit) =>
        new Promise<Response>((_, reject) =>
          init?.signal?.addEventListener('abort', () =>
            reject(new DOMException('aborted', 'AbortError')),
          ),
        ),
    ) as unknown as typeof fetch;

    const pending = detectContextWindow({
      endpoint: 'http://gpu:8000/v1',
      model: 'm',
    });
    jest.advanceTimersByTime(20_000);

    expect(await pending).toBeNull();
    jest.useRealTimers();
  });

  it('is unknown when the server cannot be reached', async () => {
    global.fetch = jest.fn().mockRejectedValue(new TypeError('fetch failed'));

    expect(
      await detectContextWindow({
        endpoint: 'http://gpu:8000/v1',
        model: 'qwen-27b',
      }),
    ).toEqual(null);
  });
});

describe('measureBudget', () => {
  it('learns tokens per character from a reply', () => {
    expect(measureBudget(49152, 2500, 10000)).toEqual({
      windowTokens: 49152,
      tokensPerChar: 0.25,
    });
  });

  it('is unknown without a window or a token count', () => {
    expect(measureBudget(null, 2500, 10000)).toEqual(null);
    expect(measureBudget(49152, null, 10000)).toEqual(null);
  });
});

describe('fitsWithAnswer', () => {
  it('fits when the prompt plus a full answer stays inside the window', () => {
    expect(
      fitsWithAnswer({ windowTokens: 14100, tokensPerChar: 0.25 }, 23600),
    ).toEqual(true);
  });

  it('does not fit when a full answer would overflow the window', () => {
    expect(
      fitsWithAnswer({ windowTokens: 14100, tokensPerChar: 0.25 }, 23700),
    ).toEqual(false);
  });

  it('always fits when the window is unknown', () => {
    expect(fitsWithAnswer(null, 10000000)).toEqual(true);
  });
});
