import { RxDatabase } from 'rxdb';

import { DatabaseCollections } from '../../app/providers/DatabaseCollections';
import { labTools } from '../patient-context/agent/labTools';
import { noteTools } from '../patient-context/agent/noteTools';
import { WireMessage } from '../patient-context/agent/ollamaChat';
import { chatSystemPrompt } from '../patient-context/agent/prompts';
import { recordTools } from '../patient-context/agent/recordTools';
import { referenceTools } from '../patient-context/agent/referenceTools';
import { runToolLoop } from '../patient-context/agent/toolLoop';
import {
  ClinicalDocStore,
  docsByType,
  loadClinicalDocs,
} from '../patient-context/clinicalDocs';
import {
  ContextBudget,
  detectContextWindow,
  fitsWithAnswer,
  measureBudget,
} from '../patient-context/agent/contextWindow';
import { MAX_CHAT_ITERATIONS } from '../patient-context/constants';
import { Harness } from '../patient-context/harness/events';
import { loggedChat } from '../patient-context/harness/loggedChat';
import { loggedToolDispatch } from '../patient-context/harness/loggedTool';
import { isAbortError } from '../patient-context/agent/abort';
import { toNoteRecords } from '../patient-context/notes/noteStore';
import { buildLabIndex } from '../patient-context/sections/labs';
import { buildRecordIndex } from '../patient-context/sections/recordIndex';

export type AgentChatResult =
  | { kind: 'answered'; answer: string; context: ContextBudget | null }
  | { kind: 'failed'; message: string }
  | { kind: 'aborted' };

export type HistoryMessage = { role: 'user' | 'assistant'; content: string };

function mustAnswer(
  turnNumber: number,
  promptChars: number,
  budget: ContextBudget | null,
): boolean {
  return (
    turnNumber >= MAX_CHAT_ITERATIONS || !fitsWithAnswer(budget, promptChars)
  );
}

export function conversationFits(
  budget: ContextBudget | null,
  history: HistoryMessage[],
  question: string,
): boolean {
  return fitsWithAnswer(
    budget,
    JSON.stringify(firstMessages(history, question)).length,
  );
}

function firstMessages(
  history: HistoryMessage[],
  question: string,
): WireMessage[] {
  return [
    {
      role: 'system',
      content: chatSystemPrompt(new Date().toISOString().slice(0, 10)),
    },
    ...history,
    { role: 'user', content: question },
  ];
}

const ANSWER_NOW: WireMessage = {
  role: 'user',
  content:
    'Tool calls are no longer available. Answer my question now from what you have already gathered, and say plainly what you could not verify.',
};

type AgentChatRequest = {
  question: string;
  history: HistoryMessage[];
  endpoint: string;
  model: string;
  apiKey?: string;
  harness: Harness;
  signal?: AbortSignal;
};

export function performAgentRequest({
  db,
  userId,
  ...request
}: AgentChatRequest & {
  db: RxDatabase<DatabaseCollections>;
  userId: string;
}): Promise<AgentChatResult> {
  return runAgentChat({
    ...request,
    loadStore: () => loadClinicalDocs(db, userId),
  });
}

/** The app's chat run over any source of the patient's clinical documents. */
export async function runAgentChat({
  question,
  history,
  loadStore,
  endpoint,
  model,
  apiKey,
  harness,
  signal,
}: AgentChatRequest & {
  loadStore: () => Promise<ClinicalDocStore>;
}): Promise<AgentChatResult> {
  harness.emit({ t: 'RunStarted', config: { endpoint, model } });
  try {
    const store = await loadStore();
    const byType = docsByType(store.docs);
    const notes = toNoteRecords(byType, harness.emit);
    harness.emit({ t: 'NotesLoaded', total: notes.length });
    const tools = [
      ...noteTools(notes, signal),
      ...labTools(buildLabIndex(byType, store.connectionLocations)),
      ...recordTools(
        buildRecordIndex(byType, store.connectionLocations, notes),
      ),
      ...referenceTools(signal),
    ];

    let windowTokens: number | null | undefined;
    let budget: ContextBudget | null = null;
    const final = await runToolLoop({
      turn: async (messages, turnNumber) => {
        const forced = mustAnswer(
          turnNumber,
          JSON.stringify(messages).length,
          budget,
        );
        const sent = forced ? [...messages, ANSWER_NOW] : messages;
        const result = await loggedChat(harness, turnNumber, {
          endpoint,
          model,
          apiKey,
          messages: sent,
          tools: forced ? undefined : tools.map((t) => t.def),
          signal,
        });
        if (result.promptTokens !== null) {
          if (windowTokens === undefined) {
            windowTokens = await detectContextWindow({
              endpoint,
              model,
              apiKey,
              signal,
            });
          }
          budget = measureBudget(
            windowTokens,
            result.promptTokens,
            JSON.stringify(sent).length,
          );
        }
        return forced ? { ...result, toolCalls: [] } : result;
      },
      execute: (call, turnNumber) =>
        loggedToolDispatch(harness, tools, call, turnNumber),
      messages: firstMessages(history, question),
    });
    const answer = final.content.trim();
    if (!answer) {
      const message = 'The model returned an empty reply.';
      harness.emit({ t: 'RunFailed', message });
      return { kind: 'failed', message };
    }
    harness.emit({ t: 'RunCompleted' });
    return {
      kind: 'answered',
      context: budget,
      answer: final.truncated
        ? `${answer}\n\n*(reply cut off: the model hit its token limit)*`
        : answer,
    };
  } catch (e) {
    if (isAbortError(e)) {
      harness.emit({ t: 'RunAborted' });
      return { kind: 'aborted' };
    }
    const message = e instanceof Error ? e.message : String(e);
    harness.emit({ t: 'RunFailed', message });
    return { kind: 'failed', message };
  }
}
