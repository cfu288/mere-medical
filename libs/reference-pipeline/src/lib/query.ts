import { DatabaseSync } from 'node:sqlite';

import { Section } from './sections';

/** The fields of a reference that a list or a citation shows. */
export type ReferenceSummary = {
  id: string;
  title: string;
  edition: string;
  summary: string;
  url: string;
};

/** One page of references and the number of references that match. */
export type ReferencePage = {
  references: ReferenceSummary[];
  total: number;
  page: number;
  pageSize: number;
};

/**
 * One section in an outline. `chars` is the length of its own text, and
 * `chunks` is the number of chunks {@link readChunk} can return for it.
 */
export type OutlineEntry = {
  sectionId: string;
  title: string;
  chars: number;
  chunks: number;
};

type OutlineLeaf = OutlineEntry & { subsectionCount: number };
type OutlineBranch = OutlineEntry & { subsections: OutlineLeaf[] };

/**
 * Two levels of a reference's sections. `section` is the section the outline
 * starts from, or null for the whole reference.
 */
export type Outline = {
  reference: ReferenceSummary;
  section: OutlineEntry | null;
  sections: OutlineBranch[];
};

/** One chunk of a section, with the section's chunk count. */
export type ChunkRead = {
  reference: ReferenceSummary;
  section: { sectionId: string; title: string };
  chunk: number;
  chunks: number;
  text: string;
};

/**
 * One chunk that matches a search. `count` is the number of matched words in
 * the chunk.
 */
export type Match = {
  sectionId: string;
  title: string;
  chunk: number;
  count: number;
  excerpt: string;
};

/** A lookup that found its reference, and its section when it asked for one. */
export type Found<T> = { kind: 'found'; value: T };

const LIST_PAGE_SIZE = 50;
const SEARCH_PAGE_SIZE = 20;
const TITLE_WEIGHT = 10;
const MATCH_START = '\u0001';
const EXCERPT_WORDS = 24;
/**
 * A run of letters or digits in any language. A search term keeps only these
 * runs, and each run goes into the query in quotes. Full-text search then reads
 * it as text, never as an operator such as `OR`, `*` or `-`. The query builders
 * NFC-normalize each term first. An accented letter then matches however the
 * stored text encodes it.
 */
const WORD = /[\p{L}\p{N}]+/gu;

/**
 * Lists the references in a library, 50 to a page, in title order. The API
 * server calls it for `GET v1/agent/references`.
 *
 * @param db `DatabaseSync`. From `openReferencesDb`.
 * @param page `number`. Starts at 1. A value that is not a whole number above
 * 1 gives page 1.
 * @returns `ReferencePage`. Empty past the last page.
 *
 * @example
 * listReferences(db, 2);
 */
export function listReferences(db: DatabaseSync, page = 1): ReferencePage {
  const current = firstPageOrLater(page);
  const { total } = db
    .prepare('SELECT COUNT(*) AS total FROM documents')
    .get() as { total: number };
  const references = pastTheEnd(current, LIST_PAGE_SIZE, total)
    ? []
    : (db
        .prepare(
          'SELECT id, title, edition, summary, url FROM documents ORDER BY title LIMIT ? OFFSET ?',
        )
        .all(
          LIST_PAGE_SIZE,
          (current - 1) * LIST_PAGE_SIZE,
        ) as unknown as ReferenceSummary[]);
  return { references, total, page: current, pageSize: LIST_PAGE_SIZE };
}

/**
 * Finds the references whose title or summary has any word of the terms, 20
 * to a page. A title match counts ten times as much as a summary match. The
 * chat agent uses it to choose a reference.
 *
 * It matches other forms of a word, such as "treatments" for "treatment". It
 * reads quotes and search operators in a term as plain words.
 *
 * @param db `DatabaseSync`. From `openReferencesDb`.
 * @param terms `string[]`. The search terms.
 * @param page `number`. Starts at 1. A value that is not a whole number above
 * 1 gives page 1.
 * @returns `ReferencePage`. Empty when the terms have no words.
 *
 * @example
 * searchReferences(db, ['hypertension', 'blood pressure']);
 */
export function searchReferences(
  db: DatabaseSync,
  terms: string[],
  page = 1,
): ReferencePage {
  const current = firstPageOrLater(page);
  const query = ftsAnyWord(terms);
  const { total } = query
    ? (db
        .prepare(
          'SELECT COUNT(*) AS total FROM documents_fts WHERE documents_fts MATCH ?',
        )
        .get(query) as { total: number })
    : { total: 0 };
  const references = pastTheEnd(current, SEARCH_PAGE_SIZE, total)
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
  return { references, total, page: current, pageSize: SEARCH_PAGE_SIZE };
}

/**
 * Returns two levels of a reference's sections. The chat agent reads the
 * outline to choose a section, and then reads that section's chunks with
 * {@link readChunk}.
 *
 * Without `sectionId`, the outline starts at the top-level sections. With it,
 * the outline starts at the subsections of that section. Each section of the
 * second level gives only the number of its own subsections.
 *
 * @param db `DatabaseSync`. From `openReferencesDb`.
 * @param id `string`. The reference id.
 * @param sectionId `string`. Optional. The section to start from.
 * @returns `Outline` as `{ kind: 'found', value }`. `no-reference` or
 * `no-section` when an id is not in the library.
 *
 * @example
 * getOutline(db, 'va-dod-hypertension');
 */
export function getOutline(
  db: DatabaseSync,
  id: string,
  sectionId?: string,
): Found<Outline> | { kind: 'no-reference' | 'no-section' } {
  const document = documentRow(db, id);
  if (!document) {
    return { kind: 'no-reference' };
  }
  const sections = document.sections;
  const start = sections.find((s) => s.sectionId === sectionId);
  if (sectionId !== undefined && !start) {
    return { kind: 'no-section' };
  }
  const chunkCounts = chunkCountsBySection(db, id);
  const entry = (section: Section): OutlineEntry => ({
    sectionId: section.sectionId,
    title: section.title,
    chars: section.textEnd - section.textStart,
    chunks: chunkCounts.get(section.sectionId) ?? 0,
  });
  const childrenOf = (parentId: string | null) =>
    sections.filter((s) => s.parentId === parentId);
  return {
    kind: 'found',
    value: {
      reference: document.summary,
      section: start ? entry(start) : null,
      sections: childrenOf(sectionId ?? null).map((branch) => ({
        ...entry(branch),
        subsections: childrenOf(branch.sectionId).map((leaf) => ({
          ...entry(leaf),
          subsectionCount: childrenOf(leaf.sectionId).length,
        })),
      })),
    },
  };
}

/**
 * Returns one chunk of a section's text. The chat agent reads a section one
 * chunk at a time, from chunk 1 to the section's chunk count.
 *
 * @param db `DatabaseSync`. From `openReferencesDb`.
 * @param id `string`. The reference id.
 * @param sectionId `string`. The section id.
 * @param chunk `number`. Starts at 1.
 * @returns `ChunkRead` as `{ kind: 'found', value }`. `no-reference` or
 * `no-section` when an id is not in the library. `no-chunk` when the section
 * has no chunk with that number, which includes every chunk of a section with
 * no text.
 *
 * @example
 * readChunk(db, 'va-dod-hypertension', 'page-34', 1);
 */
export function readChunk(
  db: DatabaseSync,
  id: string,
  sectionId: string,
  chunk: number,
): Found<ChunkRead> | { kind: 'no-reference' | 'no-section' | 'no-chunk' } {
  const document = documentRow(db, id);
  if (!document) {
    return { kind: 'no-reference' };
  }
  const section = document.sections.find((s) => s.sectionId === sectionId);
  if (!section) {
    return { kind: 'no-section' };
  }
  const row = db
    .prepare(
      'SELECT text FROM chunks_fts WHERE document_id = ? AND section_id = ? AND chunk = ?',
    )
    .get(id, sectionId, chunk) as { text: string } | undefined;
  if (!row) {
    return { kind: 'no-chunk' };
  }
  const { chunks } = db
    .prepare(
      'SELECT COUNT(*) AS chunks FROM chunks_fts WHERE document_id = ? AND section_id = ?',
    )
    .get(id, sectionId) as { chunks: number };
  return {
    kind: 'found',
    value: {
      reference: document.summary,
      section: { sectionId, title: section.title },
      chunk,
      chunks,
      text: row.text,
    },
  };
}

/**
 * Finds the chunks of one reference that match any of the terms, in reading
 * order. A term with several words matches a chunk that has all of them. The
 * chat agent uses it to find where a reference mentions something.
 *
 * It matches other forms of a word and reads quotes and search operators as
 * plain words. The excerpt is a passage of up to 24 words that has a match.
 *
 * @param db `DatabaseSync`. From `openReferencesDb`.
 * @param id `string`. The reference id.
 * @param terms `string[]`. The search terms.
 * @returns `{ matches: Match[] }` as `{ kind: 'found', value }`, in reading
 * order. No matches when the terms have no words. `no-reference` when the id
 * is not in the library.
 *
 * @example
 * findInReference(db, 'va-dod-hypertension', ['chlorthalidone']);
 */
export function findInReference(
  db: DatabaseSync,
  id: string,
  terms: string[],
): Found<{ matches: Match[] }> | { kind: 'no-reference' } {
  if (!db.prepare('SELECT 1 FROM documents WHERE id = ?').get(id)) {
    return { kind: 'no-reference' };
  }
  const query = ftsAnyTerm(terms);
  if (!query) {
    return { kind: 'found', value: { matches: [] } };
  }
  const rows = db
    .prepare(
      `SELECT c.section_id AS sectionId,
              json_extract(s.value, '$.title') AS title,
              c.chunk AS chunk,
              highlight(chunks_fts, 3, '${MATCH_START}', '') AS marked,
              snippet(chunks_fts, 3, '', '', '…', ${EXCERPT_WORDS}) AS excerpt
       FROM chunks_fts c
       JOIN documents d ON d.id = c.document_id
       JOIN json_each(d.sections) s
         ON json_extract(s.value, '$.sectionId') = c.section_id
       WHERE chunks_fts MATCH ? AND c.document_id = ?
       ORDER BY s.key, c.chunk`,
    )
    .all(query, id) as {
    sectionId: string;
    title: string;
    chunk: number;
    marked: string;
    excerpt: string;
  }[];
  return {
    kind: 'found',
    value: {
      matches: rows.map((row) => ({
        sectionId: row.sectionId,
        title: row.title,
        chunk: row.chunk,
        count: row.marked.split(MATCH_START).length - 1,
        excerpt: row.excerpt.replace(/\s+/g, ' ').trim(),
      })),
    },
  };
}

function documentRow(
  db: DatabaseSync,
  id: string,
): { summary: ReferenceSummary; sections: Section[] } | undefined {
  const row = db
    .prepare(
      'SELECT id, title, edition, summary, url, sections FROM documents WHERE id = ?',
    )
    .get(id) as (ReferenceSummary & { sections: string }) | undefined;
  if (!row) {
    return undefined;
  }
  const { sections, ...summary } = row;
  return { summary, sections: JSON.parse(sections) as Section[] };
}

function chunkCountsBySection(
  db: DatabaseSync,
  id: string,
): Map<string, number> {
  const rows = db
    .prepare(
      'SELECT section_id, COUNT(*) AS chunks FROM chunks_fts WHERE document_id = ? GROUP BY section_id',
    )
    .all(id) as { section_id: string; chunks: number }[];
  return new Map(rows.map((row) => [row.section_id, row.chunks]));
}

function pastTheEnd(page: number, pageSize: number, total: number): boolean {
  return (page - 1) * pageSize >= total;
}

function firstPageOrLater(page: number): number {
  return Number.isInteger(page) && page > 1 ? page : 1;
}

/**
 * Builds a full-text query that matches any word of any term. It lowercases
 * each word and lists it once. `['Kidney disease', 'kidney']` becomes
 * `"kidney" OR "disease"`.
 */
function ftsAnyWord(terms: string[]): string {
  const words = new Set(
    terms.flatMap(
      (term) => term.normalize('NFC').toLowerCase().match(WORD) ?? [],
    ),
  );
  return [...words].map((word) => `"${word}"`).join(' OR ');
}

/**
 * Builds a full-text query that matches any term whose words all appear in one
 * chunk. `['blood pressure', 'BP']` becomes `("blood" AND "pressure") OR ("BP")`.
 */
function ftsAnyTerm(terms: string[]): string {
  return terms
    .map((term) => term.normalize('NFC').match(WORD) ?? [])
    .filter((words) => words.length > 0)
    .map((words) => `(${words.map((word) => `"${word}"`).join(' AND ')})`)
    .join(' OR ');
}
