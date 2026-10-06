import { formatReport } from './agentBench.report';

describe('formatReport', () => {
  it('lists each case under its category with failures and a total', () => {
    expect(
      formatReport([
        {
          id: 'eliquis-dose',
          category: 'drug-label',
          outcome: { kind: 'pass' },
          turns: 7,
          calls: 13,
          opened: { opened: 4, accepted: 3 },
          windowTokens: 49152,
        },
        {
          id: 'bp-at-goal',
          category: 'guideline',
          outcome: {
            kind: 'fail',
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
        'drug-label  1/1',
        '  PASS  eliquis-dose  (7 turns, 13 calls, 3 of 4 opened accepted)',
        '',
        'guideline  0/2',
        '  FAIL  bp-at-goal  (9 turns, 16 calls, 1 of 5 opened accepted)',
        '          never read va-dod-hypertension',
        '  ERROR measles',
        '          model unreachable',
        '',
        'total  1/3',
      ].join('\n'),
    );
  });
});
