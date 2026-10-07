import { formatReport } from './agentBench.report';

describe('formatReport', () => {
  it('leads with complete runs, then waste and context, then each case with incomplete ones first', () => {
    expect(
      formatReport([
        {
          id: 'eliquis-dose',
          category: 'drug-label',
          needsPatientData: false,
          repeat: 1,
          turns: 7,
          calls: 13,
          windowTokens: 49152,
          outcome: {
            kind: 'evaluated',
            evaluation: {
              requirements: 1,
              missed: [],
              forbidden: [],
              waste: [
                {
                  item: 'label-apixaban/oral-6-adverse-reactions',
                  chars: 4000,
                },
              ],
              repeats: 1,
              peakPromptTokens: 20000,
            },
          },
        },
        {
          id: 'eliquis-dose',
          category: 'drug-label',
          needsPatientData: false,
          repeat: 2,
          turns: 6,
          calls: 9,
          windowTokens: 49152,
          outcome: {
            kind: 'evaluated',
            evaluation: {
              requirements: 1,
              missed: [],
              forbidden: [],
              waste: [],
              repeats: 0,
              peakPromptTokens: 30000,
            },
          },
        },
        {
          id: 'bp-at-goal',
          category: 'guideline',
          needsPatientData: true,
          repeat: 1,
          turns: 9,
          calls: 16,
          windowTokens: 49152,
          outcome: {
            kind: 'evaluated',
            evaluation: {
              requirements: 2,
              missed: ['note n8 part 1'],
              forbidden: [],
              waste: [],
              repeats: 0,
              peakPromptTokens: 10000,
            },
          },
        },
        {
          id: 'bp-at-goal',
          category: 'guideline',
          needsPatientData: true,
          repeat: 2,
          turns: null,
          calls: 0,
          windowTokens: null,
          outcome: { kind: 'error', message: 'model unreachable' },
        },
      ]),
    ).toEqual(
      [
        'complete runs  2/4  (cases complete in every run: 1/2)',
        '  drug-label  2/2',
        '  guideline  0/2',
        '  needs patient data  0/2',
        'forbidden calls  in 0 runs',
        'waste in complete runs  median 0.5 items (90th percentile 1), median 2,000 characters',
        'repeat reads  1',
        'peak prompt  median 20,000 tokens; over half the context window in 1 run',
        '',
        'cases, incomplete first',
        '  0/2  bp-at-goal  missed note n8 part 1 (1 run); error: model unreachable (1 run)',
        '  2/2  eliquis-dose  waste label-apixaban/oral-6-adverse-reactions (1 run)',
      ].join('\n'),
    );
  });
});
