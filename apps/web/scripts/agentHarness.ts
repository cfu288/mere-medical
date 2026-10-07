import './nodePolyfills';

import { readFileSync } from 'fs';

import {
  AgentChatResult,
  runAgentChat,
} from '../src/features/ai-chat/performAgentRequest';
import {
  ClinicalDoc,
  ClinicalDocStore,
} from '../src/features/patient-context/clinicalDocs';
import { Retrieved } from '../src/features/patient-context/agent/tools';
import { createHarness } from '../src/features/patient-context/harness/events';

export const ENDPOINT =
  process.env['BENCH_ENDPOINT'] ?? 'http://localhost:11434';
export const MODEL = process.env['BENCH_MODEL'] ?? 'qwen3.6:35b-a3b';
const PAGE_ORIGIN =
  process.env['BENCH_REFERENCE_API'] ?? 'http://localhost:8080';

const nodeFetch = globalThis.fetch;
globalThis.fetch = (input, init) =>
  nodeFetch(
    typeof input === 'string' && input.startsWith('/')
      ? `${PAGE_ORIGIN}${input}`
      : input,
    init,
  );

export type ToolCallLog = {
  turn: number;
  name: string;
  args: Record<string, unknown>;
  output: string;
  retrieved: Retrieved[];
};

export type AgentRun = {
  result: AgentChatResult;
  turns: number;
  calls: ToolCallLog[];
  /** Prompt size of each model call that reported one, in tokens. */
  promptTokens: number[];
};

type ExportCollection = { name: string; docs: unknown[] };

/** The patient export the bench runs against, from the BENCH_EXPORT environment variable. */
export function exportPath(): string {
  const path = process.env['BENCH_EXPORT'];
  if (!path) {
    throw new Error(
      'Set BENCH_EXPORT to a patient export file (Settings > Export data) to run the agent against.',
    );
  }
  return path;
}

export function loadStore(path: string): ClinicalDocStore {
  const collections: ExportCollection[] = JSON.parse(
    readFileSync(path, 'utf8'),
  ).collections;
  const docsOf = (name: string) =>
    collections.find((c) => c.name === name)?.docs ?? [];
  const connections = docsOf('connection_documents') as {
    id: string;
    location?: string;
  }[];
  return {
    docs: docsOf('clinical_documents') as ClinicalDoc[],
    connectionLocations: new Map(
      connections.flatMap((c) => (c.location ? [[c.id, c.location]] : [])),
    ),
  };
}

export async function askAgent(
  store: ClinicalDocStore,
  question: string,
): Promise<AgentRun> {
  const pending = new Map<string, Omit<ToolCallLog, 'output' | 'retrieved'>>();
  const calls: ToolCallLog[] = [];
  const promptTokens: number[] = [];
  let turns = 0;
  const harness = createHarness('bench', (event) => {
    if (event.t === 'ChatRequested') {
      turns = Math.max(turns, event.turn);
    } else if (event.t === 'ChatCompleted' && event.promptTokens !== null) {
      promptTokens.push(event.promptTokens);
    } else if (event.t === 'ToolCalled') {
      pending.set(event.toolId, {
        turn: event.turn,
        name: event.name,
        args: event.args,
      });
    } else if (event.t === 'ToolResult') {
      const called = pending.get(event.toolId);
      if (called) {
        calls.push({
          ...called,
          output: event.result,
          retrieved: event.retrieved,
        });
      }
    }
  });
  const result = await runAgentChat({
    question,
    history: [],
    loadStore: async () => store,
    endpoint: ENDPOINT,
    model: MODEL,
    harness,
  });
  return { result, turns, calls, promptTokens };
}
