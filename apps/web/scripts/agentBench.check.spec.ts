import { AgentRun } from './agentHarness';
import { BenchCase } from './agentBench.cases';
import { evaluate } from './agentBench.check';

const bpCase: BenchCase = {
  id: 'bp-at-goal',
  category: 'guideline',
  question: 'Is my blood pressure where it should be?',
  mustNotCall: ['search_labs'],
  mustRead: [
    [
      {
        reference: 'va-dod-hypertension',
        sections: ['ix-recommendations', 'page-34'],
      },
    ],
  ],
  mustRetrieve: [[{ kind: 'note', id: 'n8', part: 1 }]],
  alsoRelevant: [{ kind: 'lab', analyte: '8480-6' }],
};

const answered = {
  kind: 'answered' as const,
  answer: 'Your pressure is at goal.',
  context: null,
};

describe('evaluate', () => {
  it('finds nothing wrong with a run that was shown everything it needed and nothing else', () => {
    const run: AgentRun = {
      result: answered,
      turns: 2,
      promptTokens: [1800, 5200],
      calls: [
        {
          turn: 1,
          name: 'read_section',
          args: { reference: 'va-dod-hypertension', section: 'page-34' },
          output: 'We recommend a systolic goal of <130 mmHg.',
          retrieved: [
            {
              kind: 'section',
              reference: 'va-dod-hypertension',
              section: 'page-34',
            },
          ],
        },
        {
          turn: 2,
          name: 'read_note',
          args: { id: 'n8' },
          output: 'BP 125/84',
          retrieved: [{ kind: 'note', id: 'n8', part: 1 }],
        },
      ],
    };

    expect(evaluate(bpCase, run)).toEqual({
      requirements: 2,
      missed: [],
      forbidden: [],
      waste: [],
      repeats: 0,
      peakPromptTokens: 5200,
    });
  });

  it('names each requirement the run missed and each forbidden tool it called', () => {
    const run: AgentRun = {
      result: answered,
      turns: 1,
      promptTokens: [],
      calls: [
        {
          turn: 1,
          name: 'read_section',
          args: { reference: 'va-dod-hypertension', section: 'page-34' },
          output: 'Reference material is unavailable right now.',
          retrieved: [],
        },
        {
          turn: 1,
          name: 'search_labs',
          args: { query: 'blood pressure' },
          output: 'No matches for "blood pressure".',
          retrieved: [],
        },
      ],
    };

    expect(evaluate(bpCase, run)).toEqual({
      requirements: 2,
      missed: [
        'va-dod-hypertension (ix-recommendations | page-34)',
        'note n8 part 1',
      ],
      forbidden: ['search_labs'],
      waste: [],
      repeats: 0,
      peakPromptTokens: null,
    });
  });

  it('counts unneeded opened items with what they returned, repeat opens, and not relevant extras', () => {
    const run: AgentRun = {
      result: answered,
      turns: 3,
      promptTokens: [2400],
      calls: [
        {
          turn: 1,
          name: 'read_section',
          args: { reference: 'va-dod-hypertension', section: 'page-34' },
          output: 'We recommend a systolic goal of <130 mmHg.',
          retrieved: [
            {
              kind: 'section',
              reference: 'va-dod-hypertension',
              section: 'page-34',
            },
          ],
        },
        {
          turn: 2,
          name: 'read_section',
          args: { reference: 'va-dod-hypertension', section: 'page-34' },
          output: 'We recommend a systolic goal of <130 mmHg.',
          retrieved: [
            {
              kind: 'section',
              reference: 'va-dod-hypertension',
              section: 'page-34',
            },
          ],
        },
        {
          turn: 2,
          name: 'read_section',
          args: { reference: 'va-dod-hypertension', section: 'page-77' },
          output: 'Key question methodology.',
          retrieved: [
            {
              kind: 'section',
              reference: 'va-dod-hypertension',
              section: 'page-77',
            },
          ],
        },
        {
          turn: 3,
          name: 'get_lab_history',
          args: { analyte: '8480-6' },
          output: 'Systolic blood pressure [8480-6]: 125 mmHg (2025-11-13)',
          retrieved: [{ kind: 'lab', analyte: '8480-6' }],
        },
        {
          turn: 3,
          name: 'read_note',
          args: { id: 'n8' },
          output: 'BP 125/84',
          retrieved: [{ kind: 'note', id: 'n8', part: 1 }],
        },
      ],
    };

    expect(evaluate(bpCase, run)).toEqual({
      requirements: 2,
      missed: [],
      forbidden: [],
      waste: [{ item: 'va-dod-hypertension/page-77', chars: 25 }],
      repeats: 1,
      peakPromptTokens: 2400,
    });
  });
});
