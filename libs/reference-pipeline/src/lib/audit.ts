import { DatabaseSync } from 'node:sqlite';

export type Finding = {
  check:
    | 'dead-end'
    | 'links-only'
    | 'html-tags'
    | 'duplicate-text'
    | 'missing-parent'
    | 'replacement-character'
    | 'short-reference'
    | 'search-index'
    | 'empty-library';
  reference: string;
  section: string | null;
  detail: string;
};

type Row = {
  document_id: string;
  section_id: string;
  parent_id: string | null;
  content_md: string;
};

const SHORT_REFERENCE_CHARS = 500;
const LINK = /!?\[[^\]]*\]\([^)]*\)/g;
const HTML_TAG = /<\/?([a-z][a-z0-9]*)\b[^>]*>/gi;

/** Problems in a built library that make a section unreadable, unreachable or misleading to the agent. */
export function auditLibrary(db: DatabaseSync): Finding[] {
  const rows = db
    .prepare(
      'SELECT document_id, section_id, parent_id, content_md FROM sections ORDER BY document_id, position',
    )
    .all() as Row[];
  const ids = new Set(rows.map((r) => `${r.document_id}/${r.section_id}`));
  const parents = new Set(
    rows.flatMap((r) =>
      r.parent_id ? [`${r.document_id}/${r.parent_id}`] : [],
    ),
  );
  const firstWithText = new Map<string, string>();
  const findings: Finding[] = [];
  for (const row of rows) {
    const key = `${row.document_id}/${row.section_id}`;
    const found = (check: Finding['check'], detail: string) =>
      findings.push({
        check,
        reference: row.document_id,
        section: row.section_id,
        detail,
      });
    const text = row.content_md.trim();
    if (row.parent_id && !ids.has(`${row.document_id}/${row.parent_id}`)) {
      found('missing-parent', `parent ${row.parent_id} not found`);
    }
    if (!text) {
      if (!parents.has(key)) {
        found('dead-end', 'no text and no subsections');
      }
      continue;
    }
    if (!/\p{L}/u.test(text.replace(LINK, ''))) {
      found('links-only', 'text is only links');
    }
    const tags = [
      ...new Set(
        [...text.matchAll(HTML_TAG)].map((m) => `<${m[1].toLowerCase()}>`),
      ),
    ].sort();
    if (tags.length > 0) {
      found('html-tags', tags.join(' '));
    }
    if (text.includes('\ufffd')) {
      found('replacement-character', 'text has \ufffd');
    }
    const earlier = firstWithText.get(text);
    if (earlier) {
      found('duplicate-text', `same text as ${earlier}`);
    } else {
      firstWithText.set(text, key);
    }
  }
  return [
    ...findings,
    ...shortReferenceFindings(rows),
    ...searchIndexFindings(db),
  ];
}

function shortReferenceFindings(rows: Row[]): Finding[] {
  const chars = new Map<string, number>();
  for (const row of rows) {
    chars.set(
      row.document_id,
      (chars.get(row.document_id) ?? 0) + row.content_md.trim().length,
    );
  }
  return [...chars]
    .filter(([, total]) => total < SHORT_REFERENCE_CHARS)
    .map(([reference, total]) => ({
      check: 'short-reference' as const,
      reference,
      section: null,
      detail: `${total} characters of text`,
    }));
}

function searchIndexFindings(db: DatabaseSync): Finding[] {
  const ids = (sql: string) =>
    db.prepare(sql).all() as { reference: string; section: string | null }[];
  const found = (
    rows: { reference: string; section: string | null }[],
    detail: string,
  ): Finding[] =>
    rows.map(({ reference, section }) => ({
      check: 'search-index',
      reference,
      section,
      detail,
    }));
  const { n } = db.prepare('SELECT COUNT(*) AS n FROM documents').get() as {
    n: number;
  };
  return [
    ...(n === 0
      ? [
          {
            check: 'empty-library' as const,
            reference: '(library)',
            section: null,
            detail: 'no references',
          },
        ]
      : []),
    ...found(
      ids(`SELECT id AS reference, NULL AS section FROM (
             SELECT id, title, summary FROM documents
             EXCEPT SELECT id, title, summary FROM documents_fts)`),
      'missing from the reference search index or indexed with another title or summary',
    ),
    ...found(
      ids(`SELECT id AS reference, NULL AS section FROM (
             SELECT id FROM documents_fts EXCEPT SELECT id FROM documents)`),
      'in the reference search index but not in the library',
    ),
    ...found(
      ids(`SELECT document_id AS reference, section_id AS section FROM (
             SELECT document_id, section_id, title, content_md FROM sections
             EXCEPT SELECT document_id, section_id, title, content_md FROM sections_fts)`),
      'missing from the section search index or indexed with other text',
    ),
    ...found(
      ids(`SELECT document_id AS reference, section_id AS section FROM (
             SELECT document_id, section_id FROM sections_fts
             EXCEPT SELECT document_id, section_id FROM sections)`),
      'in the section search index but not in the library',
    ),
  ];
}
