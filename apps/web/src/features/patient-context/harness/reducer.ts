import { Logged } from './events';

export type RunState =
  | { kind: 'idle' }
  | { kind: 'running'; runId: string; activity: string };

const INITIAL: RunState = { kind: 'idle' };

function reduce(state: RunState, event: Logged): RunState {
  if (event.t === 'RunStarted') {
    return {
      kind: 'running',
      runId: event.runId,
      activity: 'loading the record',
    };
  }
  if (state.kind !== 'running' || event.runId !== state.runId) {
    return state;
  }
  switch (event.t) {
    case 'NoteExtracted':
      return {
        ...state,
        activity: `extracting note (${event.contentType}, ${Math.round(event.rawChars / 1024)}KB)`,
      };
    case 'NotesLoaded':
      return { ...state, activity: `${event.total} notes on record` };
    case 'ChatRequested':
      return { ...state, activity: `answering (turn ${event.turn})` };
    case 'RunCompleted':
    case 'RunFailed':
    case 'RunAborted':
      return INITIAL;
    default:
      return state;
  }
}

export function project(log: Logged[]): RunState {
  return log.reduce(reduce, INITIAL);
}
