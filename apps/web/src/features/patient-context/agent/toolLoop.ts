import { AssistantTurn, ToolCall, WireMessage } from './ollamaChat';

/** Runs chat turns until one comes back without tool calls; the caller's turn decides when that is. */
export async function runToolLoop({
  turn,
  execute,
  messages,
}: {
  turn: (messages: WireMessage[], turnNumber: number) => Promise<AssistantTurn>;
  execute: (call: ToolCall, turnNumber: number) => string | Promise<string>;
  messages: WireMessage[];
}): Promise<AssistantTurn> {
  for (let turnNumber = 1; ; turnNumber++) {
    const result = await turn(messages, turnNumber);
    if (result.toolCalls.length === 0) {
      return result;
    }
    messages.push(result.rawMessage);
    for (const call of result.toolCalls) {
      const content = await execute(call, turnNumber);
      messages.push({ role: 'tool', tool_call_id: call.id, content });
    }
  }
}
