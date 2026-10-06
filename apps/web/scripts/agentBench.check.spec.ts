import { AgentRun } from './agentHarness';
import { BenchCase } from './agentBench.cases';
import { check, precision } from './agentBench.check';

const bpCase: BenchCase = {
  id: 'bp-at-goal',
  category: 'guideline',
  question: 'Is my blood pressure where it should be?',
  mustCall: ['search_references'],
  mustNotCall: [],
  mustRead: [
    [
      {
        reference: 'va-dod-hypertension',
        sections: ['ix-recommendations', 'page-34'],
      },
    ],
  ],
  mustNotRead: [],
  mustRetrieve: [[{ kind: 'note', id: 'n8', part: 1 }]],
};

const answered = {
  kind: 'answered' as const,
  answer: 'Your pressure is at goal.',
  context: null,
};

describe('check', () => {
  it('passes a run that was shown an accepted section and note part', () => {
    const run: AgentRun = {
      result: answered,
      turns: 3,
      calls: [
        {
          turn: 1,
          name: 'search_references',
          args: { query: 'blood pressure' },
          output: 'va-dod-hypertension | VA-DoD Hypertension',
          retrieved: [],
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
          name: 'read_note',
          args: { id: 'n8' },
          output: 'BP 125/84',
          retrieved: [{ kind: 'note', id: 'n8', part: 1 }],
        },
      ],
    };

    expect(check(bpCase, run)).toEqual([]);
  });

  it('does not count a read that returned no section text', () => {
    const run: AgentRun = {
      result: answered,
      turns: 2,
      calls: [
        {
          turn: 1,
          name: 'search_references',
          args: { query: 'blood pressure' },
          output: 'va-dod-hypertension | VA-DoD Hypertension',
          retrieved: [],
        },
        {
          turn: 1,
          name: 'read_section',
          args: { reference: 'va-dod-hypertension', section: 'page-34' },
          output: 'Reference material is unavailable right now.',
          retrieved: [],
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

    expect(check(bpCase, run)).toEqual([
      'never read va-dod-hypertension (ix-recommendations | page-34)',
    ]);
  });

  it('does not count another part of a required note', () => {
    const run: AgentRun = {
      result: answered,
      turns: 2,
      calls: [
        {
          turn: 1,
          name: 'search_references',
          args: { query: 'blood pressure' },
          output: 'va-dod-hypertension | VA-DoD Hypertension',
          retrieved: [],
        },
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
          args: { id: 'n8', part: 2 },
          output: 'Plan: follow up in a year.',
          retrieved: [{ kind: 'note', id: 'n8', part: 2 }],
        },
      ],
    };

    expect(check(bpCase, run)).toEqual(['never retrieved note n8 part 1']);
  });

  it('fails a run where fewer than half of what it opened is accepted', () => {
    const run: AgentRun = {
      result: answered,
      turns: 3,
      calls: [
        {
          turn: 1,
          name: 'search_references',
          args: { query: 'blood pressure' },
          output: 'va-dod-hypertension | VA-DoD Hypertension',
          retrieved: [],
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
          turn: 2,
          name: 'get_lab_history',
          args: { analyte: 'glucose' },
          output: 'Glucose [2345-7]: 88 mg/dL (2025-11-10)',
          retrieved: [{ kind: 'lab', analyte: '2345-7' }],
        },
        {
          turn: 3,
          name: 'read_note',
          args: { id: 'n8' },
          output: 'BP 125/84',
          retrieved: [{ kind: 'note', id: 'n8', part: 1 }],
        },
        {
          turn: 3,
          name: 'read_note',
          args: { id: 'n3' },
          output: 'Consent form.',
          retrieved: [{ kind: 'note', id: 'n3', part: 1 }],
        },
        {
          turn: 3,
          name: 'read_note',
          args: { id: 'n4' },
          output: 'Correspondence.',
          retrieved: [{ kind: 'note', id: 'n4', part: 1 }],
        },
      ],
    };

    expect(check(bpCase, run)).toEqual([
      'opened 6 sections, note parts or lab histories, only 2 of them accepted',
    ]);
  });

  it('counts each opened item once and leaves searches out of precision', () => {
    const run: AgentRun = {
      result: answered,
      turns: 2,
      calls: [
        {
          turn: 1,
          name: 'search_labs',
          args: { query: ['glucose', 'a1c'] },
          output:
            'Glucose [2345-7] | 88 mg/dL\nHemoglobin A1c [4548-4] | 5.1 %',
          retrieved: [
            { kind: 'lab', analyte: '2345-7' },
            { kind: 'lab', analyte: '4548-4' },
          ],
        },
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
      ],
    };

    expect(precision(bpCase, run)).toEqual({ opened: 1, accepted: 1 });
  });
});
