import { RECORD_TYPES, RecordEntry, RecordType } from '../types';
import { RecordIndex } from '../sections/recordIndex';
import { formatDate } from '../types';
import { AgentTool, capLines, termMatches, toTerms } from './tools';

export function recordTools(index: RecordIndex): AgentTool[] {
  return [
    {
      def: {
        type: 'function',
        function: {
          name: 'search_records',
          description:
            "Search the medical record outside labs and note text: conditions, medications, immunizations, allergies, encounters, procedures, appointments, insurance coverage, care teams, care plans, orders, documents, and imaging/pathology reports. Record names follow each health system's own vocabulary, so pass an array of synonyms. Narrow with types, or call with no arguments for an overview of everything on record.",
          parameters: {
            type: 'object',
            properties: {
              query: {
                anyOf: [
                  { type: 'string' },
                  { type: 'array', items: { type: 'string' } },
                ],
              },
              types: {
                type: 'array',
                items: { type: 'string', enum: [...RECORD_TYPES] },
              },
            },
          },
        },
      },
      run: (args) => searchRecords(args, index),
    },
  ];
}

function searchRecords(
  args: Record<string, unknown>,
  index: RecordIndex,
): string {
  const typeList = toTerms(args['types']);
  const unknown = typeList.find(
    (t) => !(RECORD_TYPES as readonly string[]).includes(t),
  );
  if (unknown !== undefined) {
    return `Unknown type "${unknown}". Valid types: ${RECORD_TYPES.join(', ')}.`;
  }
  const types = typeList as RecordType[];
  const terms = toTerms(args['query']);
  if (terms.length === 0 && types.length === 0) {
    return overviewLines(index).join('\n');
  }
  const pool =
    types.length > 0
      ? index.entries.filter((e) => types.includes(e.type))
      : index.entries;
  const hits =
    terms.length === 0
      ? pool
      : pool.filter((e) => terms.some((term) => matches(e, term)));
  if (hits.length === 0) {
    const prefix =
      terms.length > 0
        ? `No matches for ${quoted(terms)}.`
        : `No ${types.join(', ')} records on file.`;
    return [prefix, ...overviewLines(index)].join('\n');
  }
  const missed = terms.filter((term) => !pool.some((e) => matches(e, term)));
  const listing = capLines(
    hits.map(entryLine),
    'narrow the query or the types',
  );
  return missed.length > 0
    ? `${listing}\nNo matches for ${quoted(missed)}.`
    : listing;
}

function quoted(terms: string[]): string {
  return terms.map((t) => `"${t}"`).join(', ');
}

function matches(entry: RecordEntry, term: string): boolean {
  const haystack =
    `${entry.type} ${entry.name} ${entry.facts.join(' ')}`.toLowerCase();
  return termMatches(haystack, term);
}

function entryLine(entry: RecordEntry): string {
  const facts = entry.facts.length > 0 ? ` | ${entry.facts.join(', ')}` : '';
  return `[${entry.type}] ${entry.name} | ${entry.dateLabel ?? formatDate(entry.date)}${facts}`;
}

function overviewLines(index: RecordIndex): string[] {
  const counts = new Map<RecordType, number>();
  for (const entry of index.entries) {
    counts.set(entry.type, (counts.get(entry.type) ?? 0) + 1);
  }
  const onRecord = [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([type, count]) => `${type} (${count})`)
    .join(', ');
  const lines = onRecord ? [`On record: ${onRecord}.`] : ['Nothing on record.'];
  if (index.alsoOnRecord.length > 0) {
    const also = index.alsoOnRecord
      .map((item) => `${item.type} (${item.count})`)
      .join(', ');
    lines.push(`Also on record but not searchable here: ${also}.`);
  }
  lines.push(
    'Lab results are searchable with search_labs; note text with search_notes.',
  );
  return lines;
}
