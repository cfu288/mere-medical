import {
  AgentTool,
  capLines,
  capShown,
  dispatchTool,
  runTool,
  splitDocument,
  toTerms,
  matchIndices,
} from './tools';

describe('capLines', () => {
  it('joins lines unchanged under the cap', () => {
    expect(capLines(['| a |', '| b |'], 'narrow the terms', 100)).toEqual(
      '| a |\n| b |',
    );
  });

  it('names the omitted count and the recovery path when capped', () => {
    expect(capLines(['aaaa', 'bbbb', 'cccc'], 'narrow the terms', 8)).toEqual(
      'aaaa\nbbbb\n[1 more omitted; narrow the terms]',
    );
  });

  it('truncates a first line longer than the whole cap instead of dropping it', () => {
    expect(capLines(['aaaaaaaaaa', 'bb'], 'narrow the terms', 4)).toEqual(
      'aaaa…\n[1 more omitted; narrow the terms]',
    );
  });
});

describe('splitDocument', () => {
  it('keeps a short document as one part', () => {
    expect(splitDocument('| a |\n| b |', 20)).toEqual(['| a |\n| b |']);
  });

  it('splits on line boundaries when a part fills up', () => {
    expect(
      splitDocument('| row one |\n| row two |\n| row three |', 24),
    ).toEqual(['| row one |\n| row two |', '| row three |']);
  });

  it('breaks an oversized line at the part size so no part exceeds it', () => {
    expect(splitDocument('short\nthis line is far too long\nend', 12)).toEqual([
      'short',
      'this line is',
      ' far too lon',
      'g\nend',
    ]);
  });
});

const tools: AgentTool[] = [
  {
    def: {
      type: 'function',
      function: {
        name: 'broken_tool',
        description: 'always throws',
        parameters: { type: 'object', properties: {} },
      },
    },
    run: () => {
      throw new Error('pdf worker crashed');
    },
  },
];

describe('dispatchTool', () => {
  it('contains a throwing tool as a recoverable result string', async () => {
    expect(
      await dispatchTool(tools, { name: 'broken_tool', args: {} }),
    ).toEqual(
      'Tool broken_tool failed: pdf worker crashed. Try a different tool or answer from what you already have.',
    );
  });

  it('rethrows an abort instead of containing it', async () => {
    const aborting: AgentTool[] = [
      {
        def: {
          type: 'function',
          function: {
            name: 'slow_tool',
            description: 'aborts',
            parameters: { type: 'object', properties: {} },
          },
        },
        run: () => {
          throw new DOMException('Aborted', 'AbortError');
        },
      },
    ];
    await expect(
      dispatchTool(aborting, { name: 'slow_tool', args: {} }),
    ).rejects.toThrow('Aborted');
  });

  it('normalizes and dedupes synonym terms', () => {
    expect(toTerms(['TB', 'tb ', 'tuberculosis', ''])).toEqual([
      'tb',
      'tuberculosis',
    ]);
  });

  it('answers an unknown tool with the available tools', async () => {
    expect(await dispatchTool(tools, { name: 'nope', args: {} })).toEqual(
      'Unknown tool: nope. Available tools: broken_tool.',
    );
  });
});

describe('matchIndices', () => {
  it('matches a term of three characters or fewer only as a whole word', () => {
    expect(
      matchIndices('no heartburn reported. tb screening negative.', 'tb'),
    ).toEqual([23]);
  });

  it('matches a short term containing punctuation as a bare token', () => {
    expect(matchIndices('lytes stable. k+ 4.1 today.', 'k+')).toEqual([14]);
  });
});

describe('capShown', () => {
  it('counts the lines it kept before the omission note', () => {
    expect(capShown(['aaaa', 'bbbb', 'cccc'], 'narrow the terms', 8)).toEqual({
      text: 'aaaa\nbbbb\n[1 more omitted; narrow the terms]',
      shown: 2,
    });
  });
});

describe('runTool', () => {
  it('reports nothing retrieved for a tool that returns only text', async () => {
    expect(await runTool(tools, { name: 'nope', args: {} })).toEqual({
      text: 'Unknown tool: nope. Available tools: broken_tool.',
      retrieved: [],
    });
  });

  it('reports nothing retrieved when a tool throws', async () => {
    expect(await runTool(tools, { name: 'broken_tool', args: {} })).toEqual({
      text: 'Tool broken_tool failed: pdf worker crashed. Try a different tool or answer from what you already have.',
      retrieved: [],
    });
  });
});
