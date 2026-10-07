import { isAbortError } from '../agent/abort';
import { AssistantTurn, chat } from '../agent/ollamaChat';
import { Harness } from './events';

export async function loggedChat(
  harness: Harness,
  turn: number,
  params: Parameters<typeof chat>[0],
): Promise<AssistantTurn> {
  const callId = harness.nextId('chat');
  const startedAt = Date.now();
  harness.emit({
    t: 'ChatRequested',
    callId,
    turn,
    ...(turn === 1
      ? { seedMessages: JSON.parse(JSON.stringify(params.messages)) }
      : {}),
    requestChars: JSON.stringify(params.messages).length,
  });
  try {
    const result = await chat(params);
    harness.emit({
      t: 'ChatCompleted',
      callId,
      content: result.content,
      toolCalls: result.toolCalls,
      durationMs: Date.now() - startedAt,
      promptTokens: result.promptTokens,
    });
    return result;
  } catch (e) {
    if (isAbortError(e)) {
      throw e;
    }
    harness.emit({
      t: 'ChatFailed',
      callId,
      message: e instanceof Error ? e.message : String(e),
      durationMs: Date.now() - startedAt,
    });
    throw e;
  }
}
