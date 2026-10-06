import {
  createHarness,
  Harness,
  RunEvent,
} from '../patient-context/harness/events';
import { conversationFits, runAgentChat } from './performAgentRequest';

const emptyStore = async () => ({
  docs: [],
  connectionLocations: new Map<string, string>(),
});

function recordingHarness(): { harness: Harness; events: RunEvent[] } {
  const events: RunEvent[] = [];
  return {
    events,
    harness: createHarness('run-1', (event) => events.push(event)),
  };
}

function ollamaResponse(message: Record<string, unknown>): Response {
  return { ok: true, json: async () => ({ message }) } as Response;
}

describe('conversationFits', () => {
  it('fits until the history leaves no room for an answer', () => {
    const budget = { windowTokens: 12000, tokensPerChar: 1 };
    const question = 'what was my last a1c?';
    expect(conversationFits(budget, [], question)).toEqual(true);
    expect(
      conversationFits(
        budget,
        [{ role: 'assistant', content: 'x'.repeat(5000) }],
        question,
      ),
    ).toEqual(false);
  });
});

describe('runAgentChat', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('answers through the tool loop and logs the full event trail', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(
        ollamaResponse({
          role: 'assistant',
          content: '',
          tool_calls: [
            {
              id: 'call-1',
              function: { name: 'search_labs', arguments: { query: 'a1c' } },
            },
          ],
        }),
      )
      .mockResolvedValueOnce(
        ollamaResponse({
          role: 'assistant',
          content: 'No A1c results are on record.',
        }),
      );

    const { harness, events } = recordingHarness();
    expect(
      await runAgentChat({
        question: 'what was my last a1c?',
        history: [{ role: 'assistant', content: 'Hi there!' }],
        loadStore: emptyStore,
        endpoint: 'http://localhost:11434',
        model: 'qwen3.8:27b-mlx',
        harness,
      }),
    ).toEqual({
      kind: 'answered',
      answer: 'No A1c results are on record.',
      context: null,
    });
    expect(events.map((e) => e.t)).toEqual([
      'RunStarted',
      'NotesLoaded',
      'ChatRequested',
      'ChatCompleted',
      'ToolCalled',
      'ToolResult',
      'ChatRequested',
      'ChatCompleted',
      'RunCompleted',
    ]);
    expect(events[5]).toEqual({
      t: 'ToolResult',
      runId: 'run-1',
      toolId: 'tool-1',
      name: 'search_labs',
      result:
        'No matches for "a1c". Use list_lab_analytes to see every analyte name on record.',
      retrieved: [],
    });

    const firstBody = JSON.parse(
      (global.fetch as jest.Mock).mock.calls[0][1].body,
    );
    expect(firstBody.messages).toEqual([
      {
        role: 'system',
        content: expect.stringContaining(
          "You answer a patient's questions about their own medical record",
        ),
      },
      { role: 'assistant', content: 'Hi there!' },
      { role: 'user', content: 'what was my last a1c?' },
    ]);
  });

  it('forces a toolless final turn at the iteration cap and takes it as final even if the model still tool-calls', async () => {
    const toolCallReply = ollamaResponse({
      role: 'assistant',
      content: '',
      tool_calls: [
        {
          id: 'call-1',
          function: { name: 'search_labs', arguments: { query: 'a1c' } },
        },
      ],
    });
    global.fetch = jest
      .fn()
      .mockImplementation(async (_url: string, init: { body: string }) =>
        JSON.parse(init.body).tools
          ? toolCallReply
          : ollamaResponse({
              role: 'assistant',
              content: 'Based on what I found so far, no A1c is on record.',
              tool_calls: [
                {
                  id: 'call-40',
                  function: {
                    name: 'search_labs',
                    arguments: { query: 'a1c' },
                  },
                },
              ],
            }),
      );

    const { harness } = recordingHarness();
    expect(
      await runAgentChat({
        question: 'what was my last a1c?',
        history: [],
        loadStore: emptyStore,
        endpoint: 'http://localhost:11434',
        model: 'qwen3.8:27b-mlx',
        harness,
      }),
    ).toEqual({
      kind: 'answered',
      answer: 'Based on what I found so far, no A1c is on record.',
      context: null,
    });
    expect((global.fetch as jest.Mock).mock.calls.length).toEqual(40);
    const firstBody = JSON.parse(
      (global.fetch as jest.Mock).mock.calls[0][1].body,
    );
    const lastBody = JSON.parse(
      (global.fetch as jest.Mock).mock.calls[39][1].body,
    );
    expect(firstBody.tools.length).toBeGreaterThan(0);
    expect(lastBody.tools).toBeUndefined();
    expect(lastBody.messages[lastBody.messages.length - 1]).toEqual({
      role: 'user',
      content:
        'Tool calls are no longer available. Answer my question now from what you have already gathered, and say plainly what you could not verify.',
    });
  });

  it('forces a toolless answer once the measured prompt nears the detected window', async () => {
    const fetchMock = jest
      .fn()
      .mockImplementation(async (url: string, init?: { body: string }) => {
        if (url === 'http://localhost:11434/api/ps') {
          return {
            ok: true,
            json: async () => ({
              models: [{ name: 'qwen3.8:27b-mlx', context_length: 5000 }],
            }),
          } as Response;
        }
        return JSON.parse(init?.body ?? '{}').tools
          ? ({
              ok: true,
              json: async () => ({
                message: {
                  role: 'assistant',
                  content: '',
                  tool_calls: [
                    {
                      function: {
                        name: 'search_labs',
                        arguments: { query: 'a1c' },
                      },
                    },
                  ],
                },
                prompt_eval_count: 4000,
              }),
            } as Response)
          : ({
              ok: true,
              json: async () => ({
                message: { role: 'assistant', content: 'No A1c is on record.' },
                prompt_eval_count: 4100,
              }),
            } as Response);
      });
    global.fetch = fetchMock;

    const { harness } = recordingHarness();
    const result = await runAgentChat({
      question: 'what was my last a1c?',
      history: [],
      loadStore: emptyStore,
      endpoint: 'http://localhost:11434',
      model: 'qwen3.8:27b-mlx',
      harness,
    });

    expect(result).toMatchObject({
      kind: 'answered',
      answer: 'No A1c is on record.',
      context: { windowTokens: 5000 },
    });
    expect(fetchMock.mock.calls.map((call) => call[0])).toEqual([
      'http://localhost:11434/api/chat',
      'http://localhost:11434/api/ps',
      'http://localhost:11434/api/chat',
    ]);
    expect(JSON.parse(fetchMock.mock.calls[2][1].body).tools).toBeUndefined();
  });

  it('fails the run when the model returns an empty reply', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(
        ollamaResponse({ role: 'assistant', content: '' }),
      );

    const { harness, events } = recordingHarness();
    expect(
      await runAgentChat({
        question: 'hello?',
        history: [],
        loadStore: emptyStore,
        endpoint: 'http://localhost:11434',
        model: 'qwen3.8:27b-mlx',
        harness,
      }),
    ).toEqual({
      kind: 'failed',
      message: 'The model returned an empty reply.',
    });
    expect(events.map((e) => e.t)).toEqual([
      'RunStarted',
      'NotesLoaded',
      'ChatRequested',
      'ChatCompleted',
      'RunFailed',
    ]);
  });

  it('ends with RunFailed when the model is unreachable', async () => {
    global.fetch = jest.fn().mockRejectedValue(new TypeError('fetch failed'));

    const { harness, events } = recordingHarness();
    expect(
      await runAgentChat({
        question: 'hello?',
        history: [],
        loadStore: emptyStore,
        endpoint: 'http://localhost:11434',
        model: 'qwen3.8:27b-mlx',
        harness,
      }),
    ).toEqual({
      kind: 'failed',
      message:
        'Could not reach the model server at http://localhost:11434: TypeError: fetch failed',
    });
    expect(events.map((e) => e.t)).toEqual([
      'RunStarted',
      'NotesLoaded',
      'ChatRequested',
      'ChatFailed',
      'RunFailed',
    ]);
  });

  it('ends with RunAborted when the signal aborts a request', async () => {
    global.fetch = jest
      .fn()
      .mockRejectedValue(new DOMException('Aborted', 'AbortError'));

    const { harness, events } = recordingHarness();
    expect(
      await runAgentChat({
        question: 'hello?',
        history: [],
        loadStore: emptyStore,
        endpoint: 'http://localhost:11434',
        model: 'qwen3.8:27b-mlx',
        harness,
      }),
    ).toEqual({ kind: 'aborted' });
    expect(events.map((e) => e.t)).toEqual([
      'RunStarted',
      'NotesLoaded',
      'ChatRequested',
      'RunAborted',
    ]);
  });
});
