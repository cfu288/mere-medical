import { CATEGORIES, Category } from './agentBench.cases';
import { Evaluation } from './agentBench.check';

/** A run past this share of the model's context window risks pushing out the evidence it gathered. */
const CONTEXT_ALARM_SHARE = 0.5;

export type Outcome =
  | { kind: 'evaluated'; evaluation: Evaluation }
  | { kind: 'error'; message: string };

export type CaseRun = {
  id: string;
  category: Category;
  needsPatientData: boolean;
  repeat: number;
  outcome: Outcome;
  turns: number | null;
  calls: number;
  /** Context window the app detected from the model server, if it reported one. */
  windowTokens: number | null;
};

export function isComplete(run: CaseRun): boolean {
  return (
    run.outcome.kind === 'evaluated' &&
    run.outcome.evaluation.missed.length === 0 &&
    run.outcome.evaluation.forbidden.length === 0
  );
}

function evaluations(runs: CaseRun[]): Evaluation[] {
  return runs.flatMap((r) =>
    r.outcome.kind === 'evaluated' ? [r.outcome.evaluation] : [],
  );
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

function percentile90(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.ceil(0.9 * sorted.length) - 1];
}

function count(n: number, noun: string): string {
  return `${n} ${noun}${n === 1 ? '' : 's'}`;
}

function share(runs: CaseRun[]): string {
  return `${runs.filter(isComplete).length}/${runs.length}`;
}

function tally(labels: string[]): string[] {
  const counts = new Map<string, number>();
  for (const label of labels) {
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return [...counts].map(([label, n]) => `${label} (${count(n, 'run')})`);
}

function caseLine(id: string, runs: CaseRun[]): string {
  const evaluated = evaluations(runs);
  const details = [
    ...tally(evaluated.flatMap((e) => e.missed)).map((m) => `missed ${m}`),
    ...tally(evaluated.flatMap((e) => e.forbidden)).map(
      (f) => `forbidden ${f}`,
    ),
    ...tally(
      runs.flatMap((r) =>
        r.outcome.kind === 'error' ? [r.outcome.message] : [],
      ),
    ).map((e) => `error: ${e}`),
    ...tally(
      evaluated.flatMap((e) => [...new Set(e.waste.map((w) => w.item))]),
    ).map((w) => `waste ${w}`),
  ];
  return `  ${share(runs)}  ${id}${details.length > 0 ? `  ${details.join('; ')}` : ''}`;
}

function contextLine(runs: CaseRun[]): string {
  const peaks = runs.flatMap((r) =>
    r.outcome.kind === 'evaluated' &&
    r.outcome.evaluation.peakPromptTokens !== null
      ? [
          {
            peak: r.outcome.evaluation.peakPromptTokens,
            window: r.windowTokens,
          },
        ]
      : [],
  );
  if (peaks.length === 0) {
    return 'peak prompt  not reported by the model server';
  }
  const known = peaks.filter((p) => p.window !== null);
  const alarms = known.filter(
    (p) => p.window !== null && p.peak > CONTEXT_ALARM_SHARE * p.window,
  ).length;
  return `peak prompt  median ${median(peaks.map((p) => p.peak)).toLocaleString('en-US')} tokens; ${
    known.length > 0
      ? `over half the context window in ${count(alarms, 'run')}`
      : 'context window not reported'
  }`;
}

/** Completeness first, then waste and context, then each case with incomplete ones first. */
export function formatReport(runs: CaseRun[]): string {
  const ids = [...new Set(runs.map((r) => r.id))];
  const byCase = ids.map((id) => runs.filter((r) => r.id === id));
  const completeWaste = evaluations(runs.filter(isComplete));
  const patientRuns = runs.filter((r) => r.needsPatientData);
  const categories = CATEGORIES.flatMap((category) => {
    const inCategory = runs.filter((r) => r.category === category);
    return inCategory.length > 0 ? [`  ${category}  ${share(inCategory)}`] : [];
  });
  const ordered = [...byCase].sort(
    (a, b) =>
      a.filter(isComplete).length / a.length -
        b.filter(isComplete).length / b.length ||
      a[0].id.localeCompare(b[0].id),
  );
  return [
    `complete runs  ${share(runs)}  (cases complete in every run: ${byCase.filter((c) => c.every(isComplete)).length}/${byCase.length})`,
    ...categories,
    ...(patientRuns.length > 0
      ? [`  needs patient data  ${share(patientRuns)}`]
      : []),
    `forbidden calls  in ${count(evaluations(runs).filter((e) => e.forbidden.length > 0).length, 'run')}`,
    completeWaste.length > 0
      ? `waste in complete runs  median ${median(completeWaste.map((e) => e.waste.length))} items (90th percentile ${percentile90(completeWaste.map((e) => e.waste.length))}), median ${median(completeWaste.map((e) => e.waste.reduce((sum, w) => sum + w.chars, 0))).toLocaleString('en-US')} characters`
      : 'waste in complete runs  no complete runs',
    `repeat reads  ${evaluations(runs).reduce((sum, e) => sum + e.repeats, 0)}`,
    contextLine(runs),
    '',
    'cases, incomplete first',
    ...ordered.map((c) => caseLine(c[0].id, c)),
  ].join('\n');
}
