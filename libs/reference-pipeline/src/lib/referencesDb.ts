import { DatabaseSync } from 'node:sqlite';

import { Section } from './sections';

export type ReferenceRecord = {
  id: string;
  title: string;
  edition: string;
  summary: string;
  url: string;
  sections: Section[];
};

/**
 * Opens or creates a reference library. It creates the `documents` and
 * `sections` tables and their two full-text search tables if they are missing.
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
      url        TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sections (
      document_id TEXT NOT NULL,
      section_id  TEXT NOT NULL,
      parent_id   TEXT,
      position    INTEGER NOT NULL,
      title       TEXT NOT NULL,
      page_start  INTEGER,
      page_end    INTEGER,
      content_md  TEXT NOT NULL,
      url         TEXT,
      PRIMARY KEY (document_id, section_id)
    );
    CREATE VIRTUAL TABLE IF NOT EXISTS sections_fts USING fts5(
      document_id UNINDEXED,
      section_id UNINDEXED,
      title,
      content_md,
      tokenize = 'porter unicode61'
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
 * Adds a reference and its sections to the library, and to the search
 * tables. Sections keep their order in `record.sections` as their position.
 *
 * The reference must not be in the library yet. Call {@link deleteReference}
 * first to replace one.
 *
 * @param db `DatabaseSync`. From {@link openReferencesDb}.
 * @param record `ReferenceRecord`. The reference and its sections.
 * @returns `void`.
 * @throws `Error` when a reference or section with the same id is already
 * stored.
 *
 * @example
 * writeReference(db, {
 *   id: 'measles',
 *   title: 'Measles',
 *   edition: '2026',
 *   summary: 'Vaccine schedule',
 *   url: 'https://example.com/measles',
 *   sections: [
 *     { sectionId: 'doses', parentId: null, title: 'Doses', location: { kind: 'webpage' }, contentMd: 'Two doses.' },
 *   ],
 * });
 * db.prepare('SELECT document_id, section_id, title, content_md FROM sections').all();
 * // [{ document_id: 'measles', section_id: 'doses', title: 'Doses', content_md: 'Two doses.' }]
 */
export function writeReference(db: DatabaseSync, record: ReferenceRecord) {
  db.prepare(
    'INSERT INTO documents_fts (id, title, summary) VALUES (?, ?, ?)',
  ).run(record.id, record.title, record.summary);
  db.prepare(
    'INSERT INTO documents (id, title, edition, summary, url) VALUES (?, ?, ?, ?, ?)',
  ).run(record.id, record.title, record.edition, record.summary, record.url);
  const insertSection = db.prepare(
    `INSERT INTO sections
       (document_id, section_id, parent_id, position, title, page_start, page_end, content_md, url)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const insertFts = db.prepare(
    'INSERT INTO sections_fts (document_id, section_id, title, content_md) VALUES (?, ?, ?, ?)',
  );
  record.sections.forEach((section, position) => {
    const pages =
      section.location.kind === 'pages'
        ? [section.location.start, section.location.end]
        : [null, null];
    insertSection.run(
      record.id,
      section.sectionId,
      section.parentId,
      position,
      section.title,
      pages[0],
      pages[1],
      section.contentMd,
      section.location.kind === 'webpage' ? section.location.url ?? null : null,
    );
    insertFts.run(
      record.id,
      section.sectionId,
      section.title,
      section.contentMd,
    );
  });
}

/**
 * Deletes a reference and its sections from the library and from the search
 * tables. An id that is not stored is ignored.
 *
 * @param db `DatabaseSync`. From {@link openReferencesDb}.
 * @param id `string`. The reference id.
 * @returns `void`.
 *
 * @example
 * deleteReference(db, 'measles');
 * db.prepare("SELECT id FROM documents WHERE id = 'measles'").all();
 * // []
 */
export function deleteReference(db: DatabaseSync, id: string) {
  for (const sql of [
    'DELETE FROM sections_fts WHERE document_id = ?',
    'DELETE FROM sections WHERE document_id = ?',
    'DELETE FROM documents_fts WHERE id = ?',
    'DELETE FROM documents WHERE id = ?',
  ]) {
    db.prepare(sql).run(id);
  }
}

/**
 * Deletes every reference whose id is not in the catalog any more.
 *
 * @param db `DatabaseSync`. From {@link openReferencesDb}.
 * @param ids `string[]`. The ids to keep.
 * @returns `void`.
 *
 * @example
 * // The library holds 'measles' and 'flu'.
 * deleteReferencesExcept(db, ['flu']);
 * db.prepare('SELECT id FROM documents').all();
 * // [{ id: 'flu' }]
 */
export function deleteReferencesExcept(db: DatabaseSync, ids: string[]) {
  const rows = db.prepare('SELECT id FROM documents').all() as { id: string }[];
  for (const { id } of rows) {
    if (!ids.includes(id)) {
      deleteReference(db, id);
    }
  }
}
