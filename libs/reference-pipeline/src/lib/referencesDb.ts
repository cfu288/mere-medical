import { DatabaseSync } from 'node:sqlite';

import { Part, Section } from './sections';

/**
 * One reference as the library stores it. All fields but `parts` are columns
 * of a `documents` row. `id`, `title` and `summary` are also copied to
 * `documents_fts` for search.
 */
export type ReferenceRecord = {
  /** The source's configured id. */
  id: string;
  /** The configured title. */
  title: string;
  /** The configured version or date of the publisher's edition. */
  edition: string;
  /** The configured description of what the reference covers. */
  summary: string;
  /** The page or PDF the text came from. For `cdc-media`, the cdc.gov page. */
  url: string;
  /** The whole reference as markdown, stored in the `content_md` column. */
  markdown: string;
  /** The sections in reading order, stored as JSON in the `sections` column. */
  sections: Section[];
  /** Each part is a `parts_fts` row, with `id` as its `document_id` and its `sectionId` as `section_id`. */
  parts: Part[];
};

/**
 * Opens or creates a reference library, creating its tables if they are
 * missing.
 *
 * - `documents` holds each reference, its markdown and its sections as JSON.
 * - `documents_fts` searches each reference's title and summary.
 * - `parts_fts` holds the text of each part of a section and searches it. A
 *   reader reads a part from it by reference id, section id and part number.
 *
 * {@link ReferenceRecord} describes each column.
 *
 * @param path `string`. A file path, or `':memory:'` for a library that is
 * not saved.
 * @returns `DatabaseSync`. The open library. The caller closes it.
 *
 * @example
 * const db = openReferencesDb('libs/reference-pipeline/data/references.db');
 */
export function openReferencesDb(path: string): DatabaseSync {
  const db = new DatabaseSync(path);
  db.exec(`
    CREATE TABLE IF NOT EXISTS documents (
      id         TEXT PRIMARY KEY,
      title      TEXT NOT NULL,
      edition    TEXT NOT NULL,
      summary    TEXT NOT NULL,
      url        TEXT NOT NULL,
      content_md TEXT NOT NULL,
      sections   TEXT NOT NULL
    );
    CREATE VIRTUAL TABLE IF NOT EXISTS documents_fts USING fts5(
      id UNINDEXED,
      title,
      summary,
      tokenize = 'porter unicode61'
    );
    CREATE VIRTUAL TABLE IF NOT EXISTS parts_fts USING fts5(
      document_id UNINDEXED,
      section_id UNINDEXED,
      part UNINDEXED,
      text,
      tokenize = 'porter unicode61'
    );
  `);
  return db;
}

/**
 * Adds a reference to the library with its markdown and its sections as JSON. It
 * also adds the title and summary for search, and the text of each part of each section.
 *
 * @param db `DatabaseSync`. From {@link openReferencesDb}.
 * @param record `ReferenceRecord`. The reference, its markdown and its sections.
 * @returns `void`.
 * @throws `Error` when the library already holds the reference.
 *
 * @example
 * writeReference(db, {
 *   id: 'measles',
 *   title: 'Measles',
 *   edition: '2026',
 *   summary: 'Vaccine schedule',
 *   url: 'https://example.com/measles',
 *   markdown: '# Doses\n\nTwo doses.',
 *   sections: [{ sectionId: 'doses', parentId: null, title: 'Doses', textStart: 9, textEnd: 19 }],
 *   parts: [{ sectionId: 'doses', part: 1, text: 'Two doses.' }],
 * });
 */
export function writeReference(db: DatabaseSync, record: ReferenceRecord) {
  db.prepare(
    'INSERT INTO documents (id, title, edition, summary, url, content_md, sections) VALUES (?, ?, ?, ?, ?, ?, ?)',
  ).run(
    record.id,
    record.title,
    record.edition,
    record.summary,
    record.url,
    record.markdown,
    JSON.stringify(record.sections),
  );
  db.prepare(
    'INSERT INTO documents_fts (id, title, summary) VALUES (?, ?, ?)',
  ).run(record.id, record.title, record.summary);
  const insertPart = db.prepare(
    'INSERT INTO parts_fts (document_id, section_id, part, text) VALUES (?, ?, ?, ?)',
  );
  for (const part of record.parts) {
    insertPart.run(record.id, part.sectionId, part.part, part.text);
  }
}
