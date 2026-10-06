import { isAbortError } from './abort';
import { MAX_SEARCH_RESULT_CHARS } from '../constants';
import { OllamaToolDef, ToolCall } from './ollamaChat';
import { RecordType } from '../types';

/** A lab analyte (its LOINC code, else its name), a record entry or a note whose details a tool result showed. */
export type Retrieved =
  | { kind: 'lab'; analyte: string }
  | { kind: 'record'; type: RecordType; name: string }
  | { kind: 'note'; id: string };

/** A tool's reply to the model and the patient data it showed. */
export type ToolOutput = { text: string; retrieved: Retrieved[] };

export type AgentTool = {
  def: OllamaToolDef;
  run: (
    args: Record<string, unknown>,
  ) => string | ToolOutput | Promise<string | ToolOutput>;
};

/** Runs the named tool, turning an unknown tool or a thrown error into a reply the model can recover from. */
export async function runTool(
  tools: AgentTool[],
  call: ToolCall,
): Promise<ToolOutput> {
  const tool = tools.find((t) => t.def.function.name === call.name);
  if (!tool) {
    const names = tools.map((t) => t.def.function.name).join(', ');
    return {
      text: `Unknown tool: ${call.name}. Available tools: ${names}.`,
      retrieved: [],
    };
  }
  try {
    const output = await tool.run(call.args);
    return typeof output === 'string'
      ? { text: output, retrieved: [] }
      : output;
  } catch (e) {
    if (isAbortError(e)) {
      throw e;
    }
    const message = e instanceof Error ? e.message : String(e);
    return {
      text: `Tool ${call.name} failed: ${message}. Try a different tool or answer from what you already have.`,
      retrieved: [],
    };
  }
}

export async function dispatchTool(
  tools: AgentTool[],
  call: ToolCall,
): Promise<string> {
  return (await runTool(tools, call)).text;
}

export function toTerms(query: unknown): string[] {
  const raw = Array.isArray(query) ? query : [query];
  return [
    ...new Set(
      raw
        .map((term) =>
          String(term ?? '')
            .trim()
            .toLowerCase(),
        )
        .filter(Boolean),
    ),
  ];
}

export function termMatches(haystack: string, needle: string): boolean {
  return matchIndices(haystack, needle).length > 0;
}

export function matchIndices(haystack: string, needle: string): number[] {
  const indices: number[] = [];
  let index = haystack.indexOf(needle);
  while (index !== -1) {
    if (needle.length > 3 || isBareToken(haystack, index, needle.length)) {
      indices.push(index);
    }
    index = haystack.indexOf(needle, index + 1);
  }
  return indices;
}

function isBareToken(haystack: string, start: number, length: number): boolean {
  const before = haystack[start - 1];
  const after = haystack[start + length];
  return !(before && /\w/.test(before)) && !(after && /\w/.test(after));
}

export function capLines(
  lines: string[],
  more: string,
  maxChars = MAX_SEARCH_RESULT_CHARS,
): string {
  return capShown(lines, more, maxChars).text;
}

/** Keeps lines up to maxChars, noting how many were left out, and counts the lines kept. */
export function capShown(
  lines: string[],
  more: string,
  maxChars = MAX_SEARCH_RESULT_CHARS,
): { text: string; shown: number } {
  const kept: string[] = [];
  let total = 0;
  for (const line of lines) {
    if (kept.length === 0 && line.length > maxChars) {
      kept.push(`${line.slice(0, maxChars)}…`);
      total = maxChars;
      continue;
    }
    if (total + line.length > maxChars) {
      return {
        text: [
          ...kept,
          `[${lines.length - kept.length} more omitted; ${more}]`,
        ].join('\n'),
        shown: kept.length,
      };
    }
    kept.push(line);
    total += line.length;
  }
  return { text: kept.join('\n'), shown: kept.length };
}

function breakLine(line: string, maxChars: number): string[] {
  const pieces: string[] = [];
  for (let at = 0; at < line.length; at += maxChars) {
    pieces.push(line.slice(at, at + maxChars));
  }
  return pieces.length > 0 ? pieces : [''];
}

export function splitDocument(text: string, maxChars: number): string[] {
  const parts: string[] = [];
  let current = '';
  for (const line of text.split('\n').flatMap((l) => breakLine(l, maxChars))) {
    if (current === '') {
      current = line;
    } else if (current.length + 1 + line.length > maxChars) {
      parts.push(current);
      current = line;
    } else {
      current += '\n' + line;
    }
  }
  parts.push(current);
  return parts;
}
