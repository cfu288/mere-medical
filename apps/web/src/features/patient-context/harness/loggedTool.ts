import { ToolCall } from '../agent/ollamaChat';
import { AgentTool, runTool } from '../agent/tools';
import { Harness } from './events';

export async function loggedToolDispatch(
  harness: Harness,
  tools: AgentTool[],
  call: ToolCall,
  turn: number,
): Promise<string> {
  const toolId = harness.nextId('tool');
  harness.emit({
    t: 'ToolCalled',
    turn,
    toolId,
    name: call.name,
    args: call.args,
  });
  const { text, retrieved } = await runTool(tools, call);
  harness.emit({
    t: 'ToolResult',
    toolId,
    name: call.name,
    result: text,
    retrieved,
  });
  return text;
}
