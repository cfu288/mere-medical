import {
  MAX_SEARCH_MATCHES_PER_NOTE,
  MAX_SEARCH_RESULT_CHARS,
  SEARCH_CONTEXT_CHARS,
  TOOL_PART_CHARS,
} from '../constants';
import { NoteRecord } from '../notes/noteRecord';
import { formatDate } from '../types';
import {
  AgentTool,
  capLines,
  matchIndices,
  splitDocument,
  toTerms,
} from './tools';

export function noteTools(
  notes: NoteRecord[],
  signal?: AbortSignal,
): AgentTool[] {
  return [
    {
      def: {
        type: 'function',
        function: {
          name: 'list_recent_notes',
          description:
            "List the patient's most recent clinical notes, newest first, with ids you can pass to read_note.",
          parameters: { type: 'object', properties: {} },
        },
      },
      run: () => listRecentNotes(notes),
    },
    {
      def: {
        type: 'function',
        function: {
          name: 'read_note',
          description:
            'Read the extracted plain text of one note by id. Long notes come back in parts; pass part to continue reading.',
          parameters: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              part: { type: 'integer' },
            },
            required: ['id'],
          },
        },
      },
      run: (args) =>
        readNote(String(args['id'] ?? ''), Number(args['part'] ?? 1), notes),
    },
    {
      def: {
        type: 'function',
        function: {
          name: 'search_notes',
          description:
            'Case-insensitive substring search across all note texts. Pass an array of synonyms to search them all at once. Returns matching lines with surrounding context and the note id.',
          parameters: {
            type: 'object',
            properties: {
              query: {
                anyOf: [
                  { type: 'string' },
                  { type: 'array', items: { type: 'string' } },
                ],
              },
            },
            required: ['query'],
          },
        },
      },
      run: (args) =>
        searchNotes(toTerms(args['query']), notes, undefined, signal),
    },
  ];
}

function resolveNote(ref: string, notes: NoteRecord[]): NoteRecord | undefined {
  const alias = ref.trim().toLowerCase();
  return notes.find((n) => n.alias.toLowerCase() === alias);
}

function listRecentNotes(notes: NoteRecord[]): string {
  if (notes.length === 0) {
    return 'No clinical notes on record.';
  }
  return capLines(
    notes.map(
      (note) =>
        `${note.alias} | ${formatDate(note.date)} | ${note.displayName} | ${note.contentType}`,
    ),
    'search_notes finds notes by content',
  );
}

async function readNote(
  id: string,
  part: number,
  notes: NoteRecord[],
): Promise<string> {
  const note = resolveNote(id, notes);
  if (!note) {
    return `No note with id "${id}". Use list_recent_notes to see valid ids.`;
  }
  const extracted = await note.read();
  if (extracted.kind === 'unsupported') {
    return `Note "${id}" is not readable (${extracted.reason}).`;
  }
  const parts = splitDocument(extracted.text, TOOL_PART_CHARS);
  if (!Number.isInteger(part) || part < 1 || part > parts.length) {
    return `Note "${id}" has ${parts.length} part(s); ask for a part between 1 and ${parts.length}.`;
  }
  if (parts.length === 1) {
    return parts[0];
  }
  const footer =
    part < parts.length
      ? `\n\nCall read_note with part ${part + 1} to continue.`
      : '';
  return `[part ${part} of ${parts.length}]\n${parts[part - 1]}${footer}`;
}

export async function searchNotes(
  terms: string[],
  notes: NoteRecord[],
  maxChars = MAX_SEARCH_RESULT_CHARS,
  signal?: AbortSignal,
): Promise<string> {
  if (terms.length === 0) {
    return 'Empty search query.';
  }
  const matches: string[] = [];
  const matchedTerms = new Set<string>();
  let totalChars = 0;
  let scanned = 0;
  let unreadable = 0;
  for (const note of notes) {
    if (signal?.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }
    if (totalChars >= maxChars) {
      break;
    }
    scanned += 1;
    await new Promise((resolve) => setTimeout(resolve, 0));
    const extracted = await note.read();
    if (extracted.kind !== 'text') {
      unreadable += 1;
      continue;
    }
    const haystack = extracted.text.toLowerCase();
    let perNote = 0;
    for (const needle of terms) {
      const indices = matchIndices(haystack, needle);
      if (indices.length > 0) {
        matchedTerms.add(needle);
      }
      for (const index of indices) {
        if (perNote >= MAX_SEARCH_MATCHES_PER_NOTE || totalChars >= maxChars) {
          break;
        }
        const start = Math.max(0, index - SEARCH_CONTEXT_CHARS / 2);
        const end = Math.min(
          extracted.text.length,
          index + needle.length + SEARCH_CONTEXT_CHARS / 2,
        );
        const context = extracted.text
          .slice(start, end)
          .replace(/\s+/g, ' ')
          .trim();
        const line = `${note.alias} (${formatDate(note.date)}): ...${context}...`;
        matches.push(line);
        totalChars += line.length;
        perNote += 1;
      }
    }
  }
  const unreadableNote =
    unreadable > 0 ? `\n[${unreadable} unreadable note(s) not searched]` : '';
  if (matches.length === 0) {
    return `No matches for ${terms.map((t) => `"${t}"`).join(', ')}. Use list_recent_notes and read_note to scan individual notes.${unreadableNote}`;
  }
  const scannedAll = scanned === notes.length;
  const missed = scannedAll
    ? terms.filter((term) => !matchedTerms.has(term))
    : [];
  let result = matches.join('\n');
  if (!scannedAll) {
    result += `\n[stopped after ${scanned} of ${notes.length} notes; narrow the terms to search the rest]`;
  }
  if (missed.length > 0) {
    result += `\nNo matches for ${missed.map((t) => `"${t}"`).join(', ')}.`;
  }
  return result + unreadableNote;
}
