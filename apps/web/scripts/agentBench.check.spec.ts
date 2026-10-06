import { AgentRun } from './agentHarness';
import { BenchCase } from './agentBench.cases';
import { check } from './agentBench.check';

const bpCase: BenchCase = {
  id: 'bp-at-goal',
  category: 'guideline',
  question: 'Is my blood pressure where it should be?',
  mustCall: ['search_references'],
  mustNotCall: [],
  mustRead: [
    [{ reference: 'va-dod-hypertension', sections: ['ix-recommendations'] }],
  ],
  mustNotRead: [],
  mustRetrieve: [],
};

function run(readOutput: string): AgentRun {
  return {
    result: {
      kind: 'answered',
      answer: 'Your pressure is at goal.',
      context: null,
    },
    turns: 2,
    calls: [
      {
        turn: 1,
        name: 'search_references',
        args: { query: 'blood pressure' },
        output: 'va-dod-hypertension',
        retrieved: [],
      },
      {
        turn: 2,
        name: 'read_section',
        args: {
          reference: 'va-dod-hypertension',
          section: 'ix-recommendations',
        },
        output: readOutput,
        retrieved: [],
      },
    ],
  };
}

describe('check', () => {
  it('counts a section read only when the tool returned the section', () => {
    expect(
      check(bpCase, run('Recommendation 1: treat to a goal below 130/90.')),
    ).toEqual([]);
  });

  it('does not count a read the tool answered with no section', () => {
    expect(
      check(
        bpCase,
        run(
          'No section "ix-recommendations" in va-dod-hypertension. Call get_outline with reference "va-dod-hypertension" to see its sections.',
        ),
      ),
    ).toEqual(['never read va-dod-hypertension (ix-recommendations)']);
  });

  it('does not count a read the tool answered as unavailable', () => {
    expect(
      check(bpCase, run('Reference material is unavailable right now.')),
    ).toEqual(['never read va-dod-hypertension (ix-recommendations)']);
  });
});

const metforminCase: BenchCase = {
  id: 'metformin-safe',
  category: 'drug-label',
  question:
    'I was just prescribed metformin 1000 mg twice a day. Is that safe?',
  mustCall: [],
  mustNotCall: [],
  mustRead: [],
  mustNotRead: [],
  mustRetrieve: [[{ kind: 'lab', analyte: '77147-7' }]],
};

function labRun(analyte: string): AgentRun {
  return {
    result: {
      kind: 'answered',
      answer: 'Your kidneys are fine.',
      context: null,
    },
    turns: 2,
    calls: [
      {
        turn: 1,
        name: 'get_lab_history',
        args: { analyte: 'egfr' },
        output: 'eGFR: 120 (2025-11-10)',
        retrieved: [{ kind: 'lab', analyte }],
      },
    ],
  };
}

describe('check retrieval', () => {
  it('passes when a tool showed the required analyte', () => {
    expect(check(metforminCase, labRun('77147-7'))).toEqual([]);
  });

  it('fails when the tools showed only another analyte', () => {
    expect(check(metforminCase, labRun('98979-8'))).toEqual([
      'never retrieved lab 77147-7',
    ]);
  });

  it('passes an any-of group on any one of its entries', () => {
    expect(
      check(
        {
          ...metforminCase,
          mustRetrieve: [
            [
              { kind: 'lab', analyte: '2160-0' },
              { kind: 'lab', analyte: '98979-8' },
            ],
          ],
        },
        labRun('98979-8'),
      ),
    ).toEqual([]);
  });

  it('names a required record it never retrieved', () => {
    expect(
      check(
        {
          ...metforminCase,
          mustRetrieve: [
            [{ kind: 'record', type: 'allergy', name: 'PENICILLINS' }],
          ],
        },
        labRun('77147-7'),
      ),
    ).toEqual(['never retrieved allergy PENICILLINS']);
  });

  it('names a required note it never retrieved', () => {
    expect(
      check(
        {
          ...metforminCase,
          mustRetrieve: [[{ kind: 'note', id: 'n1' }]],
        },
        labRun('77147-7'),
      ),
    ).toEqual(['never retrieved note n1']);
  });
});
