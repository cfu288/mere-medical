import { DatabaseSync } from 'node:sqlite';

import { Page, Section } from './sections';

export type ReferenceRecord = {
  id: string;
  title: string;
  edition: string;
  summary: string;
  url: string;
  markdown: string;
  sections: Section[];
  pages: Page[];
};

/**
 * Opens or creates a reference library, creating its tables if they are
 * missing.
 *
 * - `documents` holds each reference, its markdown and its sections as JSON.
 * - `documents_fts` searches each reference's title and summary.
 * - `pages_fts` holds the text of each section page and searches it. A reader
 *   reads a page from it by reference id, section id and page number.
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
    CREATE VIRTUAL TABLE IF NOT EXISTS pages_fts USING fts5(
      document_id UNINDEXED,
      section_id UNINDEXED,
      page UNINDEXED,
      text,
      tokenize = 'porter unicode61'
    );
  `);
  return db;
}

/**
 * Adds a reference to the library with its markdown and its sections as JSON. It
 * also adds the title and summary for search, and the text of each section page.
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
 *   sections: [{ sectionId: 'doses', parentId: null, title: 'Doses', textStart: 9, textEnd: 19, pageCount: 1 }],
 *   pages: [{ sectionId: 'doses', page: 1, text: 'Two doses.' }],
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
  const insertPage = db.prepare(
    'INSERT INTO pages_fts (document_id, section_id, page, text) VALUES (?, ?, ?, ?)',
  );
  for (const page of record.pages) {
    insertPage.run(record.id, page.sectionId, page.page, page.text);
  }
}
