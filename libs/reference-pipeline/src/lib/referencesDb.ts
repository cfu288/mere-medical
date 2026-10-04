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
  const columns = db
    .prepare('PRAGMA table_info(sections)')
    .all()
    .map((column) => column['name']);
  if (!columns.includes('url')) {
    db.exec('ALTER TABLE sections ADD COLUMN url TEXT');
  }
  return db;
}

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

/** Removes every reference whose id is not in the catalog any more. */
export function deleteReferencesExcept(db: DatabaseSync, ids: string[]) {
  const rows = db.prepare('SELECT id FROM documents').all() as { id: string }[];
  for (const { id } of rows) {
    if (!ids.includes(id)) {
      deleteReference(db, id);
    }
  }
}
