import { DatabaseSync } from 'node:sqlite';

import { Part, Section } from './sections';

/**
 * One reference as `writeReference` stores it. `id`, `title`, `edition` and
 * `summary` come from sources.json.
 *
 * Each field except `parts` fills one column of the reference's `documents`
 * row. `id`, `title` and `summary` also go to `documents_fts` for search.
 */
export type ReferenceRecord = {
  id: string;
  title: string;
  /** The version or date of the publisher's edition. */
  edition: string;
  summary: string;
  /** The page or PDF the text came from. For `cdc-media`, the cdc.gov page. */
  url: string;
  /** The whole reference as markdown, stored in the `content_md` column. */
  markdown: string;
  /** The sections in reading order, stored as JSON in the `sections` column. */
  sections: Section[];
  /**
   * Each part becomes a `parts_fts` row. The row's `document_id` is the
   * record's `id`, and its other columns come from the part.
   */
  parts: Part[];
};

/**
 * Opens a reference library, creating its tables when they are missing.
 * `buildReferenceLibrary` uses it to write a new library, and the API server
 * opens a built one for the chat agent.
 *
 * {@link ReferenceRecord} shows what goes into each table.
 *
 * @param path `string`. A file path, or `':memory:'` for an empty library that is
 * not saved.
 * @returns `DatabaseSync`. The caller closes it.
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
 * Stores one reference in all three tables. `buildReferenceLibrary` calls it
 * for each source that has text besides its headings.
 *
 * @param db `DatabaseSync`. From {@link openReferencesDb}.
 * @param record `ReferenceRecord`.
 * @returns `void`.
 * @throws `Error` when the library already holds a reference with this id.
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
