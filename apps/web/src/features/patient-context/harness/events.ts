import { ToolCall, WireMessage } from '../agent/ollamaChat';
import { Retrieved } from '../agent/tools';
import { NoteFormat } from '../notes/extractNoteText';

export type HarnessEvent =
  | { t: 'RunStarted'; config: { endpoint: string; model: string } }
  | {
      t: 'NoteExtracted';
      docId: string;
      contentType: string;
      rawChars: number;
      durationMs: number;
      outcome:
        | { kind: 'text'; format: NoteFormat; chars: number }
        | { kind: 'unsupported'; reason: string };
    }
  | { t: 'NotesLoaded'; total: number }
  | {
      t: 'ChatRequested';
      callId: string;
      turn: number;
      seedMessages?: WireMessage[];
      requestChars: number;
    }
  | {
      t: 'ChatCompleted';
      callId: string;
      content: string;
      toolCalls: ToolCall[];
      durationMs: number;
      promptTokens: number | null;
    }
  | { t: 'ChatFailed'; callId: string; message: string; durationMs: number }
  | {
      t: 'ToolCalled';
      turn: number;
      toolId: string;
      name: string;
      args: Record<string, unknown>;
    }
  | {
      t: 'ToolResult';
      toolId: string;
      name: string;
      result: string;
      retrieved: Retrieved[];
    }
  | { t: 'RunCompleted' }
  | { t: 'RunFailed'; message: string }
  | { t: 'RunAborted' };

export type RunEvent = HarnessEvent & { runId: string };

export type Logged = RunEvent & { env: { seq: number; at: string } };

export type Harness = {
  emit: (event: HarnessEvent) => void;
  nextId: (prefix: string) => string;
};

export function createHarness(
  runId: string,
  sink: (event: RunEvent) => void,
): Harness {
  const counters = new Map<string, number>();
  return {
    emit: (event) => sink({ ...event, runId }),
    nextId: (prefix) => {
      const next = (counters.get(prefix) ?? 0) + 1;
      counters.set(prefix, next);
      return `${prefix}-${next}`;
    },
  };
}
