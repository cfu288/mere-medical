import { WireMessage } from './ollamaChat';
import { runToolLoop } from './toolLoop';

describe('runToolLoop', () => {
  it('executes tool calls until a turn returns none, recording the transcript', async () => {
    const turn = jest
      .fn()
      .mockResolvedValueOnce({
        content: '',
        toolCalls: [
          { id: 'call-1', name: 'search_labs', args: { query: 'a1c' } },
        ],
        rawMessage: { role: 'assistant', content: '', tool_calls: ['raw'] },
      })
      .mockResolvedValueOnce({
        content: 'Your A1c was 5.1%.',
        toolCalls: [],
        rawMessage: { role: 'assistant', content: 'Your A1c was 5.1%.' },
      });
    const execute = jest.fn().mockResolvedValue('Hemoglobin A1c: 5.1%');
    const messages: WireMessage[] = [
      { role: 'user', content: 'what was my a1c?' },
    ];

    const final = await runToolLoop({ turn, execute, messages });

    expect(final.content).toEqual('Your A1c was 5.1%.');
    expect(turn).toHaveBeenCalledTimes(2);
    expect(execute).toHaveBeenCalledWith(
      { id: 'call-1', name: 'search_labs', args: { query: 'a1c' } },
      1,
    );
    expect(messages).toEqual([
      { role: 'user', content: 'what was my a1c?' },
      { role: 'assistant', content: '', tool_calls: ['raw'] },
      { role: 'tool', tool_call_id: 'call-1', content: 'Hemoglobin A1c: 5.1%' },
    ]);
  });
});
