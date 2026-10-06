import { AgentTool } from '../agent/tools';
import { createHarness, RunEvent } from './events';
import { loggedToolDispatch } from './loggedTool';

const allergies: AgentTool = {
  def: {
    type: 'function',
    function: {
      name: 'search_records',
      description: 'records',
      parameters: { type: 'object', properties: {} },
    },
  },
  run: () => ({
    text: '[allergy] PENICILLINS | 2022-08-30',
    retrieved: [{ kind: 'record', type: 'allergy', name: 'PENICILLINS' }],
  }),
};

describe('loggedToolDispatch', () => {
  it('logs the patient data a tool result showed and returns its text to the model', async () => {
    const events: RunEvent[] = [];
    const harness = createHarness('run-1', (event) => events.push(event));

    expect(
      await loggedToolDispatch(
        harness,
        [allergies],
        { id: 'call-1', name: 'search_records', args: {} },
        1,
      ),
    ).toEqual('[allergy] PENICILLINS | 2022-08-30');
    expect(events).toEqual([
      {
        t: 'ToolCalled',
        runId: 'run-1',
        turn: 1,
        toolId: 'tool-1',
        name: 'search_records',
        args: {},
      },
      {
        t: 'ToolResult',
        runId: 'run-1',
        toolId: 'tool-1',
        name: 'search_records',
        result: '[allergy] PENICILLINS | 2022-08-30',
        retrieved: [{ kind: 'record', type: 'allergy', name: 'PENICILLINS' }],
      },
    ]);
  });
});
