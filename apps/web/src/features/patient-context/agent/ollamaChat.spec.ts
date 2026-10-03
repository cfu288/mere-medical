import { chat, testOllamaConnection } from './ollamaChat';

describe('chat', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('parses content and tool calls from an Ollama response', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        message: {
          role: 'assistant',
          content: '',
          reasoning: 'long deliberation',
          refusal: null,
          tool_calls: [
            { function: { name: 'read_note', arguments: { id: 'note-1' } } },
          ],
        },
        prompt_eval_count: 415,
      }),
    } as Response);
    global.fetch = fetchMock;

    expect(
      await chat({
        endpoint: 'http://localhost:11434',
        model: 'qwen3.8:27b-mlx',
        messages: [{ role: 'user', content: 'hi' }],
      }),
    ).toEqual({
      content: '',
      toolCalls: [{ name: 'read_note', args: { id: 'note-1' } }],
      truncated: false,
      promptTokens: 415,
      rawMessage: {
        role: 'assistant',
        content: '',
        tool_calls: [
          { function: { name: 'read_note', arguments: { id: 'note-1' } } },
        ],
      },
    });
    expect(fetchMock.mock.calls[0][0]).toEqual(
      'http://localhost:11434/api/chat',
    );
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      model: 'qwen3.8:27b-mlx',
      messages: [{ role: 'user', content: 'hi' }],
      stream: false,
      options: { num_predict: 8192 },
    });
  });

  it('speaks the openai dialect when the endpoint ends in /v1', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              role: 'assistant',
              content: '',
              tool_calls: [
                {
                  id: 'call-abc',
                  function: {
                    name: 'read_note',
                    arguments: '{"id": "note-1"}',
                  },
                },
              ],
            },
          },
        ],
        usage: { prompt_tokens: 4321, completion_tokens: 2 },
      }),
    } as Response);
    global.fetch = fetchMock;

    expect(
      await chat({
        endpoint: 'http://gpu:8000/v1',
        model: 'qwen-27b',
        messages: [{ role: 'user', content: 'hi' }],
      }),
    ).toEqual({
      content: '',
      toolCalls: [
        { id: 'call-abc', name: 'read_note', args: { id: 'note-1' } },
      ],
      truncated: false,
      promptTokens: 4321,
      rawMessage: {
        role: 'assistant',
        content: '',
        tool_calls: [
          {
            id: 'call-abc',
            function: { name: 'read_note', arguments: '{"id": "note-1"}' },
          },
        ],
      },
    });
    expect(fetchMock.mock.calls[0][0]).toEqual(
      'http://gpu:8000/v1/chat/completions',
    );
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      model: 'qwen-27b',
      messages: [{ role: 'user', content: 'hi' }],
      stream: false,
      max_tokens: 8192,
    });
  });

  it.each([
    ['<think>let me check the notes</think>NONE', 'NONE'],
    ['long deliberation about the answer\n</think>\n\nNONE', 'NONE'],
    ['<think>maybe the patient has diabetes, let me check', ''],
  ])('strips reasoning from %j', async (raw, content) => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ message: { role: 'assistant', content: raw } }),
    } as Response);

    expect(
      (
        await chat({
          endpoint: 'http://localhost:11434',
          model: 'qwen3.8:27b-mlx',
          messages: [],
        })
      ).content,
    ).toEqual(content);
  });

  it('coerces non-object tool-call arguments to an empty object', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              role: 'assistant',
              content: '',
              tool_calls: [
                {
                  id: 'call-1',
                  function: { name: 'search_labs', arguments: 'null' },
                },
              ],
            },
          },
        ],
      }),
    } as Response);

    const result = await chat({
      endpoint: 'http://localhost:8000/v1',
      model: 'qwen',
      messages: [],
    });
    expect(result.toolCalls).toEqual([
      { id: 'call-1', name: 'search_labs', args: {} },
    ]);
  });

  it('names the endpoint, status, and body of a non-ok response', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 404,
      text: async () => 'model not found',
    } as Response);

    await expect(
      chat({
        endpoint: 'http://localhost:11434',
        model: 'missing-model',
        messages: [],
      }),
    ).rejects.toThrow(
      'Model server at http://localhost:11434 returned 404: model not found',
    );
  });

  it('names the endpoint when a request times out', async () => {
    global.fetch = jest
      .fn()
      .mockRejectedValue(
        new DOMException('The operation timed out.', 'TimeoutError'),
      );

    await expect(
      chat({
        endpoint: 'http://localhost:11434',
        model: 'qwen3.8:27b-mlx',
        messages: [],
      }),
    ).rejects.toThrow(
      'Model request timed out after 300s (http://localhost:11434)',
    );
  });

  it('flags a length-limited openai reply as truncated', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: { role: 'assistant', content: 'partial answer' },
            finish_reason: 'length',
          },
        ],
      }),
    } as Response);

    const result = await chat({
      endpoint: 'http://localhost:8000/v1',
      model: 'qwen',
      messages: [],
    });
    expect(result.truncated).toEqual(true);
    expect(result.content).toEqual('partial answer');
  });

  it('explains a request that overflows the context window', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 400,
      text: async () =>
        '{"error":{"message":"This model\'s maximum context length is 49152 tokens. However, you requested 51000 tokens.","code":400}}',
    } as Response);

    await expect(
      chat({
        endpoint: 'http://localhost:8000/v1',
        model: 'qwen',
        messages: [],
      }),
    ).rejects.toThrow(
      "This conversation is too long for the model's context window. Start a new chat.",
    );
  });
});

describe('testOllamaConnection', () => {
  it('sends the api key as a bearer token to an openai-compatible server', async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: true } as Response);
    global.fetch = fetchMock;

    expect(await testOllamaConnection('http://gpu:8000/v1', 'sk-test')).toBe(
      true,
    );
    expect(fetchMock).toHaveBeenCalledWith('http://gpu:8000/v1/models', {
      method: 'GET',
      headers: { Accept: 'application/json', Authorization: 'Bearer sk-test' },
    });
  });

  it('sends no authorization header without an api key', async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: true } as Response);
    global.fetch = fetchMock;

    await testOllamaConnection('http://localhost:11434');

    expect(fetchMock).toHaveBeenCalledWith('http://localhost:11434/api/tags', {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });
  });
});
