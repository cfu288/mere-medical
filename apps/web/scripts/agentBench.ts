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
import { check, describeRetrieved, precision, score } from './agentBench.check';
import {
  CaseResult,
  Outcome,
  formatReport,
  scoreByCategory,
} from './agentBench.report';

const HISTORY_DIR = 'tmp/agent-bench';
const FILTERS = process.argv.slice(2);
const CONCURRENCY = 4;

function transcript(
  bench: BenchCase,
  run: AgentRun | null,
  error: string | null,
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
  if (run) {
    const share = precision(bench, run);
    lines.push(
      `opened ${share.opened} sections, note parts or lab histories; ${share.accepted} accepted; score ${score(bench, run).toFixed(2)}`,
      '',
    );
  }
  lines.push(
    error ??
      (run?.result.kind === 'answered'
        ? `=== final answer (turn ${run.turns}) ===\n${run.result.answer}`
        : `no final answer: ${run?.result.kind === 'failed' ? run.result.message : 'aborted'}`),
  );
  return lines.join('\n');
}

async function runCase(
  store: ReturnType<typeof loadStore>,
  bench: BenchCase,
  runDir: string,
): Promise<CaseResult> {
  let run: AgentRun | null = null;
  let outcome: Outcome;
  try {
    run = await askAgent(store, bench.question);
    outcome = {
      kind: 'scored',
      score: score(bench, run),
      problems: check(bench, run),
    };
  } catch (e) {
    outcome = { kind: 'error', message: String(e) };
  }
  writeFileSync(
    join(runDir, `${bench.id}.txt`),
    transcript(bench, run, outcome.kind === 'error' ? outcome.message : null),
  );
  if (run) {
    writeFileSync(
      join(runDir, `${bench.id}.json`),
      JSON.stringify(run, null, 2),
    );
  }
  console.log(`done ${bench.id}`);
  return {
    id: bench.id,
    category: bench.category,
    outcome,
    turns: run?.turns ?? null,
    calls: run?.calls.length ?? 0,
    opened: run ? precision(bench, run) : null,
    windowTokens:
      run?.result.kind === 'answered'
        ? run.result.context?.windowTokens ?? null
        : null,
  };
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
  const startedAt = new Date().toISOString();
  const runDir = join(HISTORY_DIR, startedAt.split(':').join('-').slice(0, 19));
  mkdirSync(runDir, { recursive: true });
  const store = loadStore(exportPath());
  const results = new Map<BenchCase, CaseResult>();
  const queue = [...cases];
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      for (let bench = queue.shift(); bench; bench = queue.shift()) {
        results.set(bench, await runCase(store, bench, runDir));
      }
    }),
  );
  const ordered = cases.flatMap((bench) => results.get(bench) ?? []);
  writeFileSync(
    join(runDir, 'results.json'),
    JSON.stringify(
      {
        startedAt,
        commit: execSync('git rev-parse --short HEAD').toString().trim(),
        model: MODEL,
        endpoint: ENDPOINT,
        filters: FILTERS,
        scores: scoreByCategory(ordered),
        results: ordered,
      },
      null,
      2,
    ),
  );
  const windows = [...new Set(ordered.map((r) => r.windowTokens))];
  console.log(
    `\n${formatReport(ordered)}\n\n${MODEL} at ${ENDPOINT}, detected context window: ${windows.map((w) => w ?? 'none').join(', ')} tokens\nsaved to ${runDir}`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
