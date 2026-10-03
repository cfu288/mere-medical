import { ToolCall } from '../agent/ollamaChat';
import { AgentTool, dispatchTool } from '../agent/tools';
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
  const result = await dispatchTool(tools, call);
  harness.emit({ t: 'ToolResult', toolId, name: call.name, result });
  return result;
}
