import { WireMessage } from '../agent/ollamaChat';
import { createHarness, Harness, RunEvent } from './events';
import { loggedChat } from './loggedChat';

function recordingHarness(): { harness: Harness; events: RunEvent[] } {
  const events: RunEvent[] = [];
  return {
    events,
    harness: createHarness('run-1', (event) => events.push(event)),
  };
}

describe('loggedChat', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('snapshots the seed so later mutation does not change the event', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ message: { role: 'assistant', content: 'ok' } }),
    } as Response);

    const messages: WireMessage[] = [{ role: 'user', content: 'first' }];
    const { harness, events } = recordingHarness();
    await loggedChat(harness, 1, {
      endpoint: 'http://localhost:11434',
      model: 'qwen3.8:27b-mlx',
      messages,
    });
    messages.push({ role: 'user', content: 'added later' });

    const requested = events[0] as Extract<RunEvent, { t: 'ChatRequested' }>;
    expect(requested.seedMessages).toEqual([
      { role: 'user', content: 'first' },
    ]);
  });

  it('records no seed on later turns of a thread', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ message: { role: 'assistant', content: 'ok' } }),
    } as Response);

    const { harness, events } = recordingHarness();
    await loggedChat(harness, 2, {
      endpoint: 'http://localhost:11434',
      model: 'qwen3.8:27b-mlx',
      messages: [{ role: 'user', content: 'first' }],
    });

    const requested = events[0] as Extract<RunEvent, { t: 'ChatRequested' }>;
    expect(requested.seedMessages).toBeUndefined();
    expect(requested.requestChars).toEqual(35);
  });

  it('logs the prompt size the model server reported', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        message: { role: 'assistant', content: 'ok' },
        prompt_eval_count: 1234,
      }),
    } as Response);

    const { harness, events } = recordingHarness();
    await loggedChat(harness, 1, {
      endpoint: 'http://localhost:11434',
      model: 'qwen3.8:27b-mlx',
      messages: [{ role: 'user', content: 'first' }],
    });

    const completed = events[1] as Extract<RunEvent, { t: 'ChatCompleted' }>;
    expect(completed.promptTokens).toEqual(1234);
  });
});
