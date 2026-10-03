import { Logged } from './events';
import { project } from './reducer';

const config = { endpoint: 'http://localhost:11434', model: 'qwen3.6:35b-a3b' };

const happyLog: Logged[] = [
  {
    t: 'RunStarted',
    runId: 'run-1',
    config,
    env: { seq: 0, at: '2026-09-20T14:00:00.000Z' },
  },
  {
    t: 'NoteExtracted',
    runId: 'run-1',
    docId: 'note-1',
    contentType: 'application/pdf',
    rawChars: 204800,
    durationMs: 1200,
    outcome: { kind: 'text', format: 'pdf', chars: 9000 },
    env: { seq: 1, at: '2026-09-20T14:00:02.000Z' },
  },
  {
    t: 'NotesLoaded',
    runId: 'run-1',
    total: 1,
    env: { seq: 2, at: '2026-09-20T14:00:03.000Z' },
  },
  {
    t: 'ChatRequested',
    runId: 'run-1',
    callId: 'chat-1',
    turn: 1,
    seedMessages: [{ role: 'user', content: 'what was my last a1c?' }],
    requestChars: 120,
    env: { seq: 3, at: '2026-09-20T14:00:04.000Z' },
  },
  {
    t: 'ChatRequested',
    runId: 'run-1',
    callId: 'chat-2',
    turn: 2,
    requestChars: 400,
    env: { seq: 4, at: '2026-09-20T14:00:08.000Z' },
  },
  {
    t: 'RunCompleted',
    runId: 'run-1',
    env: { seq: 5, at: '2026-09-20T14:00:10.000Z' },
  },
];

const abortLog: Logged[] = [
  {
    t: 'RunStarted',
    runId: 'run-3',
    config,
    env: { seq: 22, at: '2026-09-20T14:20:00.000Z' },
  },
  {
    t: 'RunAborted',
    runId: 'run-3',
    env: { seq: 23, at: '2026-09-20T14:20:05.000Z' },
  },
];

describe('project', () => {
  it('folds a full chat run back to idle', () => {
    expect(project(happyLog)).toEqual({ kind: 'idle' });
  });

  it('a later run in the same log supersedes the earlier one', () => {
    expect(project([...happyLog, abortLog[0]])).toEqual({
      kind: 'running',
      runId: 'run-3',
      activity: 'loading the record',
    });
  });

  it('is idle for an empty log', () => {
    expect(project([])).toEqual({ kind: 'idle' });
  });

  it('shows the run as loading right after RunStarted', () => {
    expect(project(happyLog.slice(0, 1))).toEqual({
      kind: 'running',
      runId: 'run-1',
      activity: 'loading the record',
    });
  });

  it('carries the note extraction activity mid-run', () => {
    expect(project(happyLog.slice(0, 2))).toEqual({
      kind: 'running',
      runId: 'run-1',
      activity: 'extracting note (application/pdf, 200KB)',
    });
  });

  it('shows the answering turn while a chat request is in flight', () => {
    expect(project(happyLog.slice(0, 5))).toEqual({
      kind: 'running',
      runId: 'run-1',
      activity: 'answering (turn 2)',
    });
  });
});
