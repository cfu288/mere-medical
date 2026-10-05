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
};

function run(readOutput: string): AgentRun {
  return {
    result: { kind: 'answered', answer: 'Your pressure is at goal.' },
    turns: 2,
    calls: [
      {
        turn: 1,
        name: 'search_references',
        args: { query: 'blood pressure' },
        output: 'va-dod-hypertension',
      },
      {
        turn: 2,
        name: 'read_section',
        args: {
          reference: 'va-dod-hypertension',
          section: 'ix-recommendations',
        },
        output: readOutput,
      },
    ],
  } as AgentRun;
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
