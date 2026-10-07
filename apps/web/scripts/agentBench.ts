import { execSync } from 'child_process';
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

import {
  exportPath,
  ENDPOINT,
  MODEL,
  AgentRun,
  askAgent,
  loadStore,
} from './agentHarness';
import { BENCH_CASES, BenchCase } from './agentBench.cases';
import { Evaluation, describeRetrieved, evaluate } from './agentBench.check';
import {
  CaseRun,
  Outcome,
  formatReport,
  isComplete,
} from './agentBench.report';

const HISTORY_DIR = 'tmp/agent-bench';
const FILTERS = process.argv.slice(2);
const CONCURRENCY = 4;

/** How many times each case runs, from BENCH_REPEATS; agents vary run to run, so one run cannot tell a real difference from chance. */
function repeats(): number {
  const raw = process.env['BENCH_REPEATS'] ?? '3';
  const n = Number(raw.trim());
  if (!Number.isInteger(n) || n < 1) {
    throw new Error(
      `BENCH_REPEATS must be a whole number of 1 or more, got "${raw}"`,
    );
  }
  return n;
}

function summary(evaluation: Evaluation): string[] {
  return [
    `requirements met ${evaluation.requirements - evaluation.missed.length}/${evaluation.requirements}`,
    ...evaluation.missed.map((m) => `missed ${m}`),
    ...evaluation.forbidden.map((f) => `forbidden call ${f}`),
    `waste ${evaluation.waste.length} items, ${evaluation.waste.reduce((sum, w) => sum + w.chars, 0)} characters${evaluation.waste.length > 0 ? `: ${evaluation.waste.map((w) => w.item).join('; ')}` : ''}`,
    `repeat reads ${evaluation.repeats}`,
    `peak prompt ${evaluation.peakPromptTokens ?? 'not reported'} tokens`,
  ];
}

function transcript(
  bench: BenchCase,
  run: AgentRun | null,
  outcome: Outcome,
): string {
  const lines = [`# ${bench.id}`, `question: ${bench.question}`, ''];
  for (const call of run?.calls ?? []) {
    lines.push(
      `[turn ${call.turn}] ${call.name}(${JSON.stringify(call.args)})`,
      call.output,
      ...(call.retrieved.length > 0
        ? [`retrieved: ${call.retrieved.map(describeRetrieved).join('; ')}`]
        : []),
      '',
    );
  }
  lines.push(
    ...(outcome.kind === 'evaluated'
      ? [...summary(outcome.evaluation), '']
      : [`error: ${outcome.message}`, '']),
    run?.result.kind === 'answered'
      ? `=== final answer (turn ${run.turns}) ===\n${run.result.answer}`
      : 'no final answer',
  );
  return lines.join('\n');
}

async function runCase(
  store: ReturnType<typeof loadStore>,
  bench: BenchCase,
  repeat: number,
  runDir: string,
): Promise<CaseRun> {
  let run: AgentRun | null = null;
  let outcome: Outcome;
  try {
    run = await askAgent(store, bench.question);
    outcome =
      run.result.kind === 'answered'
        ? { kind: 'evaluated', evaluation: evaluate(bench, run) }
        : {
            kind: 'error',
            message:
              run.result.kind === 'failed' ? run.result.message : 'run aborted',
          };
  } catch (e) {
    outcome = { kind: 'error', message: String(e) };
  }
  const name = `${bench.id}.${repeat}`;
  writeFileSync(join(runDir, `${name}.txt`), transcript(bench, run, outcome));
  if (run) {
    writeFileSync(join(runDir, `${name}.json`), JSON.stringify(run, null, 2));
  }
  const result: CaseRun = {
    id: bench.id,
    category: bench.category,
    needsPatientData: bench.mustRetrieve.length > 0,
    repeat,
    outcome,
    turns: run?.turns ?? null,
    calls: run?.calls.length ?? 0,
    windowTokens:
      run?.result.kind === 'answered'
        ? run.result.context?.windowTokens ?? null
        : null,
  };
  console.log(`done ${name}${isComplete(result) ? '' : ' (incomplete)'}`);
  return result;
}

async function main() {
  const cases = BENCH_CASES.filter(
    (c) =>
      FILTERS.length === 0 ||
      FILTERS.includes(c.id) ||
      FILTERS.includes(c.category),
  );
  if (cases.length === 0) {
    throw new Error(`No bench case or category matches: ${FILTERS.join(' ')}`);
  }
  const times = repeats();
  const startedAt = new Date().toISOString();
  const runDir = join(HISTORY_DIR, startedAt.split(':').join('-').slice(0, 19));
  mkdirSync(runDir, { recursive: true });
  const store = loadStore(exportPath());
  const jobs = cases.flatMap((bench) =>
    Array.from({ length: times }, (_, i) => ({ bench, repeat: i + 1 })),
  );
  const queue = [...jobs];
  const runs: CaseRun[] = [];
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      for (let job = queue.shift(); job; job = queue.shift()) {
        runs.push(await runCase(store, job.bench, job.repeat, runDir));
      }
    }),
  );
  const ordered = jobs.flatMap(
    (job) =>
      runs.find((r) => r.id === job.bench.id && r.repeat === job.repeat) ?? [],
  );
  writeFileSync(
    join(runDir, 'results.json'),
    JSON.stringify(
      {
        startedAt,
        commit: execSync('git rev-parse --short HEAD').toString().trim(),
        model: MODEL,
        endpoint: ENDPOINT,
        filters: FILTERS,
        repeats: times,
        runs: ordered,
      },
      null,
      2,
    ),
  );
  console.log(
    `\n${formatReport(ordered)}\n\n${MODEL} at ${ENDPOINT}, ${times} run(s) per case\nsaved to ${runDir}`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
