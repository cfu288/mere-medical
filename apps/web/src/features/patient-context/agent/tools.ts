import { isAbortError } from './abort';
import { MAX_SEARCH_RESULT_CHARS } from '../constants';
import { OllamaToolDef, ToolCall } from './ollamaChat';

export type AgentTool = {
  def: OllamaToolDef;
  run: (args: Record<string, unknown>) => string | Promise<string>;
};

export async function dispatchTool(
  tools: AgentTool[],
  call: ToolCall,
): Promise<string> {
  const tool = tools.find((t) => t.def.function.name === call.name);
  if (!tool) {
    const names = tools.map((t) => t.def.function.name).join(', ');
    return `Unknown tool: ${call.name}. Available tools: ${names}.`;
  }
  try {
    return await tool.run(call.args);
  } catch (e) {
    if (isAbortError(e)) {
      throw e;
    }
    const message = e instanceof Error ? e.message : String(e);
    return `Tool ${call.name} failed: ${message}. Try a different tool or answer from what you already have.`;
  }
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
  const kept: string[] = [];
  let total = 0;
  for (const line of lines) {
    if (kept.length === 0 && line.length > maxChars) {
      kept.push(`${line.slice(0, maxChars)}…`);
      total = maxChars;
      continue;
    }
    if (total + line.length > maxChars) {
      kept.push(`[${lines.length - kept.length} more omitted; ${more}]`);
      break;
    }
    kept.push(line);
    total += line.length;
  }
  return kept.join('\n');
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
