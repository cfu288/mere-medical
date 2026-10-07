import { Retrieved } from '../src/features/patient-context/agent/tools';
import { BenchCase } from './agentBench.cases';
import { AgentRun } from './agentHarness';

const OPENING_TOOLS = ['read_section', 'read_note', 'get_lab_history'];

/** What a run gathered for its case: the requirements it missed, forbidden tools it called, what it opened without needing it, and how full its prompt got. */
export type Evaluation = {
  requirements: number;
  missed: string[];
  forbidden: string[];
  waste: { item: string; chars: number }[];
  repeats: number;
  peakPromptTokens: number | null;
};

function sameRetrieved(a: Retrieved, b: Retrieved): boolean {
  switch (a.kind) {
    case 'lab':
      return b.kind === 'lab' && a.analyte === b.analyte;
    case 'record':
      return b.kind === 'record' && a.type === b.type && a.name === b.name;
    case 'note':
      return b.kind === 'note' && a.id === b.id && a.part === b.part;
    case 'section':
      return (
        b.kind === 'section' &&
        a.reference === b.reference &&
        a.section === b.section
      );
  }
}

export function describeRetrieved(item: Retrieved): string {
  switch (item.kind) {
    case 'lab':
      return `lab ${item.analyte}`;
    case 'record':
      return `${item.type} ${item.name}`;
    case 'note':
      return `note ${item.id} part ${item.part}`;
    case 'section':
      return `${item.reference}/${item.section}`;
  }
}

function sectionsOf(bench: BenchCase): Retrieved[] {
  return bench.mustRead.flatMap((anyOf) =>
    anyOf.flatMap((read) =>
      read.sections.map(
        (section): Retrieved => ({
          kind: 'section',
          reference: read.reference,
          section,
        }),
      ),
    ),
  );
}

export function evaluate(bench: BenchCase, run: AgentRun): Evaluation {
  const retrieved = run.calls.flatMap((call) => call.retrieved);
  const seen = (item: Retrieved) =>
    retrieved.some((got) => sameRetrieved(item, got));
  const called = new Set(run.calls.map((call) => call.name));
  const worthOpening = [
    ...sectionsOf(bench),
    ...bench.mustRetrieve.flat(),
    ...bench.alsoRelevant,
  ];
  const opened: Retrieved[] = [];
  const waste: Evaluation['waste'] = [];
  let repeats = 0;
  for (const call of run.calls.filter((c) => OPENING_TOOLS.includes(c.name))) {
    for (const item of call.retrieved) {
      if (opened.some((earlier) => sameRetrieved(earlier, item))) {
        repeats += 1;
        continue;
      }
      opened.push(item);
      if (!worthOpening.some((wanted) => sameRetrieved(wanted, item))) {
        waste.push({
          item: describeRetrieved(item),
          chars: call.output.length,
        });
      }
    }
  }
  return {
    requirements: bench.mustRead.length + bench.mustRetrieve.length,
    missed: [
      ...bench.mustRead
        .filter(
          (anyOf) =>
            !anyOf.some((read) =>
              read.sections.some((section) =>
                seen({ kind: 'section', reference: read.reference, section }),
              ),
            ),
        )
        .map((anyOf) =>
          anyOf
            .map((read) => `${read.reference} (${read.sections.join(' | ')})`)
            .join(' or '),
        ),
      ...bench.mustRetrieve
        .filter((anyOf) => !anyOf.some(seen))
        .map((anyOf) => anyOf.map(describeRetrieved).join(' or ')),
    ],
    forbidden: bench.mustNotCall.filter((tool) => called.has(tool)),
    waste,
    repeats,
    peakPromptTokens:
      run.promptTokens.length > 0 ? Math.max(...run.promptTokens) : null,
  };
}
