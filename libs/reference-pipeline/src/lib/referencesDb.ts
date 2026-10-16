import { DatabaseSync } from 'node:sqlite';

import { Section } from './sections';

export type ReferenceRecord = {
  id: string;
  title: string;
  edition: string;
  summary: string;
  url: string;
  markdown: string;
  sections: Section[];
};

/**
 * Opens or creates a reference library. It creates the `documents` table and
 * its full-text search table, `documents_fts`, if they are missing. The search
 * table holds each reference's id, title and summary.
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
  `);
  return db;
}

/**
 * Adds a reference to the library with its markdown, and adds its title and
 * summary to the search table. It stores the sections as JSON.
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
 *   sections: [{ sectionId: 'doses', parentId: null, title: 'Doses', pages: null, textStart: 9, textEnd: 19 }],
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
}
