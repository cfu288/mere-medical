import { Logged } from './events';

export type LogLine = {
  id: string;
  time: string;
  kind: 'info' | 'chat' | 'tool' | 'error';
  text: string;
  detail?: string;
};

export function describe(event: Logged): LogLine {
  const line = (
    kind: LogLine['kind'],
    text: string,
    detail?: string,
  ): LogLine => ({
    id: String(event.env.seq),
    time: timeOf(event.env.at),
    kind,
    text,
    ...(detail ? { detail } : {}),
  });
  switch (event.t) {
    case 'RunStarted':
      return line(
        'info',
        `run started (${event.config.model} @ ${event.config.endpoint})`,
      );
    case 'NoteExtracted': {
      const outcome =
        event.outcome.kind === 'text'
          ? `${event.outcome.format} (${event.outcome.chars} chars)`
          : `unsupported (${event.outcome.reason})`;
      return line(
        'info',
        `note extracted: ${event.contentType}, ${Math.round(event.rawChars / 1024)}KB -> ${outcome} in ${event.durationMs}ms`,
      );
    }
    case 'NotesLoaded':
      return line('info', `${event.total} notes on record`);
    case 'ChatRequested': {
      const newestMessage = event.seedMessages?.[event.seedMessages.length - 1];
      return line(
        'chat',
        `${event.callId}: turn ${event.turn} (${event.requestChars} chars)`,
        newestMessage ? JSON.stringify(newestMessage, null, 2) : undefined,
      );
    }
    case 'ChatCompleted': {
      if (event.toolCalls.length === 0 && event.content.trim() === '') {
        return line(
          'error',
          `${event.callId}: done in ${(event.durationMs / 1000).toFixed(1)}s, EMPTY reply`,
        );
      }
      const summary =
        event.toolCalls.length > 0
          ? `tool calls: ${event.toolCalls.map((c) => c.name).join(', ')}`
          : `text reply (${event.content.length} chars)`;
      return line(
        'chat',
        `${event.callId}: done in ${(event.durationMs / 1000).toFixed(1)}s, ${summary}`,
        event.toolCalls.length > 0
          ? JSON.stringify(event.toolCalls, null, 2)
          : event.content,
      );
    }
    case 'ChatFailed':
      return line(
        'error',
        `${event.callId}: failed after ${(event.durationMs / 1000).toFixed(1)}s, ${event.message}`,
      );
    case 'ToolCalled':
      return line(
        'tool',
        `${event.name}(${summarizeArgs(event.args)})`,
        Object.keys(event.args).length > 0
          ? JSON.stringify(event.args, null, 2)
          : undefined,
      );
    case 'ToolResult':
      return line(
        'tool',
        `${event.name} -> ${event.result.length} chars`,
        event.result,
      );
    case 'RunCompleted':
      return line('info', 'run completed');
    case 'RunFailed':
      return line('error', `run failed: ${event.message}`);
    case 'RunAborted':
      return line('info', 'run aborted');
  }
}

export function projectVisibleLog(log: Logged[]): LogLine[] {
  const lines: LogLine[] = [];
  let i = 0;
  while (i < log.length) {
    const event = log[i];
    if (event.t === 'NoteExtracted') {
      let end = i;
      while (end < log.length && log[end].t === 'NoteExtracted') {
        end += 1;
      }
      const burst = log.slice(i, end);
      if (burst.length > 1) {
        const unsupported = burst.filter(
          (e) => e.t === 'NoteExtracted' && e.outcome.kind === 'unsupported',
        ).length;
        lines.push({
          id: String(event.env.seq),
          time: timeOf(event.env.at),
          kind: 'info',
          text: `extracted ${burst.length} notes${unsupported > 0 ? ` (${unsupported} unsupported)` : ''}`,
          detail: burst
            .map(describe)
            .map((line) => line.text)
            .join('\n'),
        });
        i = end;
        continue;
      }
    }
    lines.push(describe(event));
    i += 1;
  }
  return lines;
}

export type RunSummary = {
  turns: number;
  toolCalls: number;
  durationMs: number;
};

export function summarizeRun(log: Logged[]): RunSummary {
  let turns = 0;
  let toolCalls = 0;
  for (const event of log) {
    if (event.t === 'ChatCompleted') {
      turns += 1;
    }
    if (event.t === 'ToolCalled') {
      toolCalls += 1;
    }
  }
  const durationMs =
    log.length === 0
      ? 0
      : new Date(log[log.length - 1].env.at).getTime() -
        new Date(log[0].env.at).getTime();
  return { turns, toolCalls, durationMs };
}

function timeOf(at: string): string {
  return new Date(at).toLocaleTimeString([], { hour12: false });
}

function summarizeArgs(args: Record<string, unknown>): string {
  const summary = Object.values(args).map(String).join(', ');
  return summary.length > 80 ? summary.slice(0, 77) + '...' : summary;
}
