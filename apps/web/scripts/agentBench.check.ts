import { Retrieved } from '../src/features/patient-context/agent/tools';
import { BenchCase } from './agentBench.cases';
import { AgentRun } from './agentHarness';

const OPENING_TOOLS = ['read_section', 'read_note', 'get_lab_history'];

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

function accepted(bench: BenchCase): Retrieved[] {
  return [
    ...bench.mustRead.flatMap((anyOf) =>
      anyOf.flatMap((read) =>
        read.sections.map(
          (section): Retrieved => ({
            kind: 'section',
            reference: read.reference,
            section,
          }),
        ),
      ),
    ),
    ...bench.mustRetrieve.flat(),
  ];
}

/** The distinct sections, note parts and lab histories a run opened, and how many of them its case accepts. */
export function precision(
  bench: BenchCase,
  run: AgentRun,
): { opened: number; accepted: number } {
  const opened: Retrieved[] = [];
  for (const item of run.calls
    .filter((call) => OPENING_TOOLS.includes(call.name))
    .flatMap((call) => call.retrieved)) {
    if (!opened.some((seen) => sameRetrieved(seen, item))) {
      opened.push(item);
    }
  }
  const wanted = accepted(bench);
  return {
    opened: opened.length,
    accepted: opened.filter((item) =>
      wanted.some((want) => sameRetrieved(want, item)),
    ).length,
  };
}

/** What the run missed of its case's requirements and which forbidden calls or reads it made. */
function findings(
  bench: BenchCase,
  run: AgentRun,
): { missed: string[]; forbidden: string[] } {
  const called = new Set(run.calls.map((call) => call.name));
  const retrieved = run.calls.flatMap((call) => call.retrieved);
  const seen = (item: Retrieved) =>
    retrieved.some((got) => sameRetrieved(item, got));
  return {
    missed: [
      ...bench.mustCall
        .filter((tool) => !called.has(tool))
        .map((tool) => `never called ${tool}`),
      ...bench.mustRead
        .filter(
          (anyOf) =>
            !anyOf.some((read) =>
              read.sections.some((section) =>
                seen({ kind: 'section', reference: read.reference, section }),
              ),
            ),
        )
        .map(
          (anyOf) =>
            `never read ${anyOf
              .map((read) => `${read.reference} (${read.sections.join(' | ')})`)
              .join(' or ')}`,
        ),
      ...bench.mustRetrieve
        .filter((anyOf) => !anyOf.some(seen))
        .map(
          (anyOf) =>
            `never retrieved ${anyOf.map(describeRetrieved).join(' or ')}`,
        ),
    ],
    forbidden: [
      ...bench.mustNotCall
        .filter((tool) => called.has(tool))
        .map((tool) => `called ${tool}`),
      ...bench.mustNotRead
        .filter((reference) =>
          retrieved.some(
            (got) => got.kind === 'section' && got.reference === reference,
          ),
        )
        .map((reference) => `read ${reference}`),
    ],
  };
}

export function check(bench: BenchCase, run: AgentRun): string[] {
  if (run.result.kind === 'failed') {
    return [run.result.message];
  }
  if (run.result.kind === 'aborted') {
    return ['run aborted'];
  }
  const { missed, forbidden } = findings(bench, run);
  return [...missed, ...forbidden];
}

/** Share of the case's requirements the run met: tools called, section groups read and record groups retrieved. */
export function recall(bench: BenchCase, run: AgentRun): number {
  const total =
    bench.mustCall.length + bench.mustRead.length + bench.mustRetrieve.length;
  return total === 0 ? 1 : (total - findings(bench, run).missed.length) / total;
}

/** recall squared times precision, so missing what was needed costs more than reading extra, and reading everything costs most; 0 for a run that failed or made a forbidden call or read. */
export function score(bench: BenchCase, run: AgentRun): number {
  if (
    run.result.kind !== 'answered' ||
    findings(bench, run).forbidden.length > 0
  ) {
    return 0;
  }
  const share = precision(bench, run);
  const shareAccepted = share.opened === 0 ? 1 : share.accepted / share.opened;
  return recall(bench, run) ** 2 * shareAccepted;
}
