import {
  describe as describeEvent,
  projectVisibleLog,
  summarizeRun,
} from './describe';
import { Logged } from './events';

const env = { seq: 5, at: '2026-09-20T14:00:00.000Z' };

describe('describeEvent', () => {
  it('flags an empty ChatCompleted reply as an error line', () => {
    const event: Logged = {
      t: 'ChatCompleted',
      runId: 'run-1',
      callId: 'chat-1',
      content: '',
      toolCalls: [],
      durationMs: 99000,
      promptTokens: null,
      env,
    };
    expect(describeEvent(event)).toEqual({
      id: '5',
      time: '10:00:00',
      kind: 'error',
      text: 'chat-1: done in 99.0s, EMPTY reply',
    });
  });

  it('describes ChatCompleted with tool call names', () => {
    const event: Logged = {
      t: 'ChatCompleted',
      runId: 'run-1',
      callId: 'chat-2',
      content: '',
      toolCalls: [
        { name: 'list_recent_notes', args: {} },
        { name: 'read_note', args: { id: 'note-1' } },
      ],
      durationMs: 3200,
      promptTokens: null,
      env,
    };
    expect(describeEvent(event)).toEqual({
      id: '5',
      time: '10:00:00',
      kind: 'chat',
      text: 'chat-2: done in 3.2s, tool calls: list_recent_notes, read_note',
      detail:
        '[\n  {\n    "name": "list_recent_notes",\n    "args": {}\n  },\n  {\n    "name": "read_note",\n    "args": {\n      "id": "note-1"\n    }\n  }\n]',
    });
  });
});

describe('summarizeRun', () => {
  it('counts turns and tool calls and spans first to last event', () => {
    const log: Logged[] = [
      {
        t: 'RunStarted',
        runId: 'run-1',
        config: {
          endpoint: 'http://localhost:11434',
          model: 'qwen3.8:27b-mlx',
        },
        env: { seq: 0, at: '2026-09-29T23:59:26.000Z' },
      },
      {
        t: 'ChatCompleted',
        runId: 'run-1',
        callId: 'chat-1',
        content: '',
        toolCalls: [{ name: 'search_labs', args: { query: 'a1c' } }],
        durationMs: 2000,
        promptTokens: null,
        env: { seq: 1, at: '2026-09-29T23:59:28.000Z' },
      },
      {
        t: 'ToolCalled',
        runId: 'run-1',
        turn: 1,
        toolId: 'tool-1',
        name: 'search_labs',
        args: { query: 'a1c' },
        env: { seq: 2, at: '2026-09-29T23:59:28.000Z' },
      },
      {
        t: 'ToolResult',
        runId: 'run-1',
        toolId: 'tool-1',
        name: 'search_labs',
        result: 'No matches for "a1c".',
        retrieved: [],
        env: { seq: 3, at: '2026-09-29T23:59:28.000Z' },
      },
      {
        t: 'ChatCompleted',
        runId: 'run-1',
        callId: 'chat-2',
        content: 'No A1c on record.',
        toolCalls: [],
        durationMs: 3000,
        promptTokens: null,
        env: { seq: 4, at: '2026-09-29T23:59:31.000Z' },
      },
      {
        t: 'RunCompleted',
        runId: 'run-1',
        env: { seq: 5, at: '2026-09-29T23:59:31.500Z' },
      },
    ];
    expect(summarizeRun(log)).toEqual({
      turns: 2,
      toolCalls: 1,
      durationMs: 5500,
    });
  });
});

describe('projectVisibleLog', () => {
  it('collapses consecutive note extractions into one line', () => {
    const log: Logged[] = [
      {
        t: 'NoteExtracted',
        runId: 'run-1',
        docId: 'note-1',
        contentType: 'application/pdf',
        rawChars: 204800,
        durationMs: 1200,
        outcome: { kind: 'text', format: 'pdf', chars: 9000 },
        env: { seq: 1, at: '2026-09-20T14:00:00.000Z' },
      },
      {
        t: 'NoteExtracted',
        runId: 'run-1',
        docId: 'note-2',
        contentType: 'application/xml',
        rawChars: 30720,
        durationMs: 2,
        outcome: { kind: 'unsupported', reason: 'empty' },
        env: { seq: 2, at: '2026-09-20T14:00:01.000Z' },
      },
      {
        t: 'RunCompleted',
        runId: 'run-1',
        env: { seq: 3, at: '2026-09-20T14:00:02.000Z' },
      },
    ];
    expect(projectVisibleLog(log)).toEqual([
      {
        id: '1',
        time: '10:00:00',
        kind: 'info',
        text: 'extracted 2 notes (1 unsupported)',
        detail:
          'note extracted: application/pdf, 200KB -> pdf (9000 chars) in 1200ms\nnote extracted: application/xml, 30KB -> unsupported (empty) in 2ms',
      },
      { id: '3', time: '10:00:02', kind: 'info', text: 'run completed' },
    ]);
  });

  it('renders one line per event with request and tool details', () => {
    const log: Logged[] = [
      {
        t: 'RunStarted',
        runId: 'run-1',
        config: {
          endpoint: 'http://localhost:11434',
          model: 'qwen3.6:35b-a3b',
        },
        env: { seq: 0, at: '2026-09-20T14:00:00.000Z' },
      },
      {
        t: 'NotesLoaded',
        runId: 'run-1',
        total: 2,
        env: { seq: 1, at: '2026-09-20T14:00:01.000Z' },
      },
      {
        t: 'ChatRequested',
        runId: 'run-1',
        callId: 'chat-1',
        turn: 1,
        seedMessages: [{ role: 'user', content: 'what was my last a1c?' }],
        requestChars: 120,
        env: { seq: 2, at: '2026-09-20T14:00:02.000Z' },
      },
      {
        t: 'ToolCalled',
        runId: 'run-1',
        turn: 1,
        toolId: 'tool-1',
        name: 'search_labs',
        args: { query: 'a1c' },
        env: { seq: 3, at: '2026-09-20T14:00:03.000Z' },
      },
      {
        t: 'ToolResult',
        runId: 'run-1',
        toolId: 'tool-1',
        name: 'search_labs',
        result: 'No matches for "a1c".',
        retrieved: [],
        env: { seq: 4, at: '2026-09-20T14:00:04.000Z' },
      },
      {
        t: 'ChatRequested',
        runId: 'run-1',
        callId: 'chat-2',
        turn: 2,
        requestChars: 400,
        env: { seq: 5, at: '2026-09-20T14:00:05.000Z' },
      },
      {
        t: 'ChatFailed',
        runId: 'run-1',
        callId: 'chat-2',
        message: 'Model request timed out after 300s',
        durationMs: 300000,
        env: { seq: 6, at: '2026-09-20T14:00:06.000Z' },
      },
      {
        t: 'RunFailed',
        runId: 'run-1',
        message: 'Model request timed out after 300s',
        env: { seq: 7, at: '2026-09-20T14:00:07.000Z' },
      },
    ];
    expect(projectVisibleLog(log)).toEqual([
      {
        id: '0',
        time: '10:00:00',
        kind: 'info',
        text: 'run started (qwen3.6:35b-a3b @ http://localhost:11434)',
      },
      { id: '1', time: '10:00:01', kind: 'info', text: '2 notes on record' },
      {
        id: '2',
        time: '10:00:02',
        kind: 'chat',
        text: 'chat-1: turn 1 (120 chars)',
        detail: '{\n  "role": "user",\n  "content": "what was my last a1c?"\n}',
      },
      {
        id: '3',
        time: '10:00:03',
        kind: 'tool',
        text: 'search_labs(a1c)',
        detail: '{\n  "query": "a1c"\n}',
      },
      {
        id: '4',
        time: '10:00:04',
        kind: 'tool',
        text: 'search_labs -> 21 chars',
        detail: 'No matches for "a1c".',
      },
      {
        id: '5',
        time: '10:00:05',
        kind: 'chat',
        text: 'chat-2: turn 2 (400 chars)',
      },
      {
        id: '6',
        time: '10:00:06',
        kind: 'error',
        text: 'chat-2: failed after 300.0s, Model request timed out after 300s',
      },
      {
        id: '7',
        time: '10:00:07',
        kind: 'error',
        text: 'run failed: Model request timed out after 300s',
      },
    ]);
  });
});
