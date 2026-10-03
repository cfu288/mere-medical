import { DatabaseSync } from 'node:sqlite';

import { Location } from './sections';

export type ReferenceSummary = {
  id: string;
  title: string;
  edition: string;
  summary: string;
  url: string;
};

export type ReferencePage = {
  references: ReferenceSummary[];
  total: number;
  page: number;
  pageSize: number;
};

const LIST_PAGE_SIZE = 50;
const SEARCH_PAGE_SIZE = 20;
const TITLE_WEIGHT = 10;

type OutlineEntry = {
  sectionId: string;
  title: string;
  chars: number;
  location: Location;
};

export type OutlineLeaf = OutlineEntry & { subsectionCount: number };
export type OutlineBranch = OutlineEntry & { subsections: OutlineLeaf[] };

export type Outline = {
  reference: ReferenceSummary;
  section: OutlineEntry | null;
  sections: OutlineBranch[];
};

export type SectionRead = {
  reference: ReferenceSummary;
  section: {
    sectionId: string;
    title: string;
    location: Location;
    contentMd: string;
    subsections: OutlineEntry[];
  };
};

export type Matches = {
  matches: {
    sectionId: string;
    title: string;
    count: number;
    excerpt: string;
  }[];
};

export type Found<T> = { kind: 'found'; value: T };

export type OutlineResult =
  | Found<Outline>
  | { kind: 'no-reference' }
  | { kind: 'no-section' };

export type SectionResult =
  | Found<SectionRead>
  | { kind: 'no-reference' }
  | { kind: 'no-section' };

export type FindResult = Found<Matches> | { kind: 'no-reference' };

type SectionRow = {
  section_id: string;
  parent_id: string | null;
  title: string;
  page_start: number | null;
  page_end: number | null;
  chars: number;
};

const MATCH_START = '\u0001';
const EXCERPT_WORDS = 24;

export function listReferences(db: DatabaseSync, page = 1): ReferencePage {
  const current = firstPageOrLater(page);
  const { total } = db
    .prepare('SELECT COUNT(*) AS total FROM documents')
    .get() as { total: number };
  const rows = pastTheEnd(current, LIST_PAGE_SIZE, total)
    ? []
    : (db
        .prepare(
          'SELECT id, title, edition, summary, url FROM documents ORDER BY title LIMIT ? OFFSET ?',
        )
        .all(
          LIST_PAGE_SIZE,
          (current - 1) * LIST_PAGE_SIZE,
        ) as unknown as ReferenceSummary[]);
  return {
    references: rows,
    total,
    page: current,
    pageSize: LIST_PAGE_SIZE,
  };
}

export function searchReferences(
  db: DatabaseSync,
  terms: string[],
  page = 1,
): ReferencePage {
  const current = firstPageOrLater(page);
  const query = ftsAnyWord(terms);
  if (!query) {
    return {
      references: [],
      total: 0,
      page: current,
      pageSize: SEARCH_PAGE_SIZE,
    };
  }
  const { total } = db
    .prepare(
      'SELECT COUNT(*) AS total FROM documents_fts WHERE documents_fts MATCH ?',
    )
    .get(query) as { total: number };
  const rows = pastTheEnd(current, SEARCH_PAGE_SIZE, total)
    ? []
    : (db
        .prepare(
          `SELECT d.id, d.title, d.edition, d.summary, d.url
       FROM documents_fts
       JOIN documents d ON d.id = documents_fts.id
       WHERE documents_fts MATCH ?
       ORDER BY bm25(documents_fts, 0, ${TITLE_WEIGHT}, 1), d.title
       LIMIT ? OFFSET ?`,
        )
        .all(
          query,
          SEARCH_PAGE_SIZE,
          (current - 1) * SEARCH_PAGE_SIZE,
        ) as unknown as ReferenceSummary[]);
  return {
    references: rows,
    total,
    page: current,
    pageSize: SEARCH_PAGE_SIZE,
  };
}

function pastTheEnd(page: number, pageSize: number, total: number): boolean {
  return (page - 1) * pageSize >= total;
}

function firstPageOrLater(page: number): number {
  return Number.isInteger(page) && page > 1 ? page : 1;
}

function ftsAnyWord(terms: string[]): string {
  const words = new Set(
    terms.flatMap((term) => term.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []),
  );
  return [...words].map((w) => `"${w}"`).join(' OR ');
}

function ftsAnyTerm(terms: string[]): string {
  return terms
    .map((term) => term.match(/[\p{L}\p{N}]+/gu) ?? [])
    .filter((words) => words.length > 0)
    .map((words) => `(${words.map((w) => `"${w}"`).join(' AND ')})`)
    .join(' OR ');
}

export function getOutline(
  db: DatabaseSync,
  id: string,
  sectionId?: string,
): OutlineResult {
  const document = documentRow(db, id);
  if (!document) {
    return { kind: 'no-reference' };
  }
  const sections = sectionRows(db, id);
  const expanded =
    sectionId === undefined
      ? null
      : sections.find((s) => s.section_id === sectionId);
  if (expanded === undefined) {
    return { kind: 'no-section' };
  }
  const childrenOf = (parent: string | null) =>
    sections.filter((s) => s.parent_id === parent);
  return {
    kind: 'found',
    value: {
      reference: document,
      section: expanded && outlineEntry(expanded),
      sections: childrenOf(sectionId ?? null).map((branch) => ({
        ...outlineEntry(branch),
        subsections: childrenOf(branch.section_id).map((leaf) => ({
          ...outlineEntry(leaf),
          subsectionCount: childrenOf(leaf.section_id).length,
        })),
      })),
    },
  };
}

export function readSection(
  db: DatabaseSync,
  id: string,
  sectionId: string,
): SectionResult {
  const document = documentRow(db, id);
  if (!document) {
    return { kind: 'no-reference' };
  }
  const section = db
    .prepare(
      `SELECT section_id, parent_id, title, page_start, page_end, length(content_md) AS chars, content_md
       FROM sections WHERE document_id = ? AND section_id = ?`,
    )
    .get(id, sectionId) as unknown as
    | (SectionRow & { content_md: string })
    | undefined;
  if (!section) {
    return { kind: 'no-section' };
  }
  const children = db
    .prepare(
      `SELECT section_id, parent_id, title, page_start, page_end, length(content_md) AS chars
       FROM sections WHERE document_id = ? AND parent_id = ? ORDER BY position`,
    )
    .all(id, sectionId) as unknown as SectionRow[];
  return {
    kind: 'found',
    value: {
      reference: document,
      section: {
        sectionId: section.section_id,
        title: section.title,
        location: location(section),
        contentMd: section.content_md,
        subsections: children.map(outlineEntry),
      },
    },
  };
}

export function findInReference(
  db: DatabaseSync,
  id: string,
  terms: string[],
): FindResult {
  if (!documentRow(db, id)) {
    return { kind: 'no-reference' };
  }
  const query = ftsAnyTerm(terms);
  if (!query) {
    return { kind: 'found', value: { matches: [] } };
  }
  const rows = db
    .prepare(
      `SELECT s.section_id AS sectionId, s.title AS title,
              highlight(sections_fts, 2, '${MATCH_START}', '') ||
              highlight(sections_fts, 3, '${MATCH_START}', '') AS marked,
              snippet(sections_fts, 3, '', '', '…', ${EXCERPT_WORDS}) AS excerpt
       FROM sections_fts
       JOIN sections s
         ON s.document_id = sections_fts.document_id
        AND s.section_id = sections_fts.section_id
       WHERE sections_fts MATCH ? AND sections_fts.document_id = ?
       ORDER BY s.position`,
    )
    .all(query, id) as unknown as {
    sectionId: string;
    title: string;
    marked: string;
    excerpt: string;
  }[];
  return {
    kind: 'found',
    value: {
      matches: rows.map((row) => ({
        sectionId: row.sectionId,
        title: row.title,
        count: row.marked.split(MATCH_START).length - 1,
        excerpt: row.excerpt.replace(/\s+/g, ' ').trim(),
      })),
    },
  };
}

function documentRow(
  db: DatabaseSync,
  id: string,
): ReferenceSummary | undefined {
  const row = db
    .prepare(
      'SELECT id, title, edition, summary, url FROM documents WHERE id = ?',
    )
    .get(id) as unknown as ReferenceSummary | undefined;
  return row;
}

function sectionRows(db: DatabaseSync, id: string): SectionRow[] {
  return db
    .prepare(
      `SELECT section_id, parent_id, title, page_start, page_end, length(content_md) AS chars
       FROM sections WHERE document_id = ? ORDER BY position`,
    )
    .all(id) as unknown as SectionRow[];
}

function outlineEntry(row: SectionRow): OutlineEntry {
  return {
    sectionId: row.section_id,
    title: row.title,
    chars: row.chars,
    location: location(row),
  };
}

function location(row: SectionRow): Location {
  return row.page_start !== null && row.page_end !== null
    ? { kind: 'pages', start: row.page_start, end: row.page_end }
    : { kind: 'webpage' };
}
