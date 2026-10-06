import { formatReport } from './agentBench.report';

describe('formatReport', () => {
  it('lists each case under its category with failures and a total', () => {
    expect(
      formatReport([
        {
          id: 'eliquis-dose',
          category: 'drug-label',
          outcome: { kind: 'scored', score: 0.75, problems: [] },
          turns: 7,
          calls: 13,
          opened: { opened: 4, accepted: 3 },
          windowTokens: 49152,
        },
        {
          id: 'bp-at-goal',
          category: 'guideline',
          outcome: {
            kind: 'scored',
            score: 0,
            problems: ['never read va-dod-hypertension'],
          },
          turns: 9,
          calls: 16,
          opened: { opened: 5, accepted: 1 },
          windowTokens: 49152,
        },
        {
          id: 'measles',
          category: 'guideline',
          outcome: { kind: 'error', message: 'model unreachable' },
          turns: null,
          calls: 0,
          opened: null,
          windowTokens: null,
        },
      ]),
    ).toEqual(
      [
        'drug-label  mean 0.75 over 1 case',
        '  0.75  eliquis-dose  (7 turns, 13 calls, 3 of 4 opened accepted)',
        '',
        'guideline  mean 0.00 over 2 cases',
        '  0.00  bp-at-goal  (9 turns, 16 calls, 1 of 5 opened accepted)',
        '          never read va-dod-hypertension',
        '  ERROR measles',
        '          model unreachable',
        '',
        'total  mean 0.25 over 3 cases',
      ].join('\n'),
    );
  });
});
