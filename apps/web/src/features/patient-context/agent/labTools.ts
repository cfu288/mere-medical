import { LabIndexEntry } from '../sections/labs';
import { formatDate } from '../types';
import { AgentTool, capLines, toTerms } from './tools';

export function labTools(index: LabIndexEntry[]): AgentTool[] {
  return [
    {
      def: {
        type: 'function',
        function: {
          name: 'search_labs',
          description:
            'Search lab results by analyte, panel, or LOINC code. Names follow each lab\'s own vocabulary ("Hgb", "QUANTIFERON(R)-TB GOLD PLUS"), so pass an array of synonyms and abbreviations to search them all at once. Values outside their reference range are marked with *.',
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
      run: (args) => searchLabs(toTerms(args['query']), index),
    },
    {
      def: {
        type: 'function',
        function: {
          name: 'list_lab_analytes',
          description:
            'List every distinct lab analyte on record with its LOINC code and name variants. Use when searches miss: the record is small enough to scan.',
          parameters: { type: 'object', properties: {} },
        },
      },
      run: () => listLabAnalytes(index),
    },
    {
      def: {
        type: 'function',
        function: {
          name: 'get_lab_history',
          description:
            'Return every dated result for one analyte, newest first. Accepts an analyte name from search_labs/list_lab_analytes or a LOINC code. Values outside their reference range are marked with *.',
          parameters: {
            type: 'object',
            properties: { analyte: { type: 'string' } },
            required: ['analyte'],
          },
        },
      },
      run: (args) => getLabHistory(String(args['analyte'] ?? ''), index),
    },
  ];
}

function matches(entry: LabIndexEntry, term: string): boolean {
  return (
    entry.code?.toLowerCase() === term ||
    entry.names.some((name) => name.toLowerCase().includes(term)) ||
    entry.panelNames.some((name) => name.toLowerCase().includes(term))
  );
}

function searchLabs(terms: string[], index: LabIndexEntry[]): string {
  if (terms.length === 0) {
    return 'Empty search query.';
  }
  const hits = index.filter((entry) =>
    terms.some((term) => matches(entry, term)),
  );
  if (hits.length === 0) {
    return `No matches for ${quoted(terms)}. Use list_lab_analytes to see every analyte name on record.`;
  }
  const missed = terms.filter(
    (term) => !index.some((entry) => matches(entry, term)),
  );
  const listing = capLines(
    hits.map(summaryLine),
    'narrow the terms or use get_lab_history for one analyte',
  );
  return missed.length > 0
    ? `${listing}\nNo matches for ${quoted(missed)}.`
    : listing;
}

function quoted(terms: string[]): string {
  return terms.map((t) => `"${t}"`).join(', ');
}

function summaryLine(entry: LabIndexEntry): string {
  const latest = entry.results[0];
  const oldest = entry.results[entry.results.length - 1];
  const days = new Set(entry.results.map((r) => formatDate(r.date))).size;
  const values =
    days > 1
      ? `${entry.results.length} results ${formatDate(oldest.date)}..${formatDate(latest.date)}, latest ${valueOf(latest)} (${formatDate(latest.date)})`
      : `${entry.results.map(valueOf).join(', ')} (${formatDate(latest.date)})`;
  const also =
    entry.names.length > 1 ? ` | also: ${entry.names.slice(1).join(', ')}` : '';
  const panel =
    entry.panelNames.length > 0
      ? ` | panel: ${entry.panelNames.join(', ')}`
      : '';
  return `${labelFor(entry)} | ${values}${also}${panel}`;
}

function listLabAnalytes(index: LabIndexEntry[]): string {
  if (index.length === 0) {
    return 'No lab results on record.';
  }
  const lines = index
    .map((entry) => {
      const also =
        entry.names.length > 1
          ? ` (also: ${entry.names.slice(1).join(', ')})`
          : '';
      return `${labelFor(entry)}${also}`;
    })
    .sort((a, b) => a.localeCompare(b));
  return capLines(lines, 'search_labs finds analytes by name');
}

function getLabHistory(ref: string, index: LabIndexEntry[]): string {
  const raw = ref.trim();
  if (!raw) {
    return 'Empty analyte.';
  }
  const bracket = raw.match(/^(.*?)\s*\[([^\]]+)\]$/);
  const needles = (bracket ? [bracket[2], bracket[1]] : [raw])
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  const codeMiss =
    bracket &&
    !index.some(
      (entry) => entry.code?.toLowerCase() === bracket[2].trim().toLowerCase(),
    )
      ? bracket[2].trim()
      : undefined;
  const withCodeNote = (entry: LabIndexEntry): string => {
    const note = codeMiss
      ? `No analyte with code "${codeMiss}"; matched "${entry.names[0]}" by name.\n`
      : '';
    return note + renderHistory(entry);
  };
  for (const needle of needles) {
    const exact = index.filter(
      (entry) =>
        entry.code?.toLowerCase() === needle ||
        entry.names.some((name) => name.toLowerCase() === needle),
    );
    if (exact.length === 1) {
      return withCodeNote(exact[0]);
    }
  }
  const candidates = index.filter((entry) =>
    needles.some((needle) => matches(entry, needle)),
  );
  if (candidates.length === 0) {
    return `No analyte matching "${ref}". Use list_lab_analytes to see every analyte name on record.`;
  }
  if (candidates.length > 1) {
    return `Matches ${candidates.length} analytes: ${candidates.map(labelFor).join('; ')}. Be more specific.`;
  }
  return withCodeNote(candidates[0]);
}

function renderHistory(entry: LabIndexEntry): string {
  const series = entry.results
    .map((r) => `${valueOf(r)} (${formatDate(r.date)})`)
    .join(', ');
  return `${labelFor(entry)}: ${series}`;
}

function labelFor(entry: LabIndexEntry): string {
  return `${entry.names[0]}${entry.code ? ` [${entry.code}]` : ''}`;
}

function valueOf(result: LabIndexEntry['results'][number]): string {
  const unit = result.unit ? ` ${result.unit}` : '';
  return `${result.display}${unit}${result.abnormal ? '*' : ''}`;
}
