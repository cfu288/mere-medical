import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

import { openReferencesDb, writeReference } from './referencesDb';

describe('openReferencesDb', () => {
  it('adds the section url column to a library created before it existed', () => {
    const path = join(mkdtempSync(join(tmpdir(), 'refs-')), 'references.db');
    const old = new DatabaseSync(path);
    old.exec(`
      CREATE TABLE sections (
        document_id TEXT NOT NULL,
        section_id  TEXT NOT NULL,
        parent_id   TEXT,
        position    INTEGER NOT NULL,
        title       TEXT NOT NULL,
        page_start  INTEGER,
        page_end    INTEGER,
        content_md  TEXT NOT NULL,
        PRIMARY KEY (document_id, section_id)
      );
    `);
    old.close();

    const db = openReferencesDb(path);

    expect(
      db
        .prepare('PRAGMA table_info(sections)')
        .all()
        .map((column) => column['name']),
    ).toEqual([
      'document_id',
      'section_id',
      'parent_id',
      'position',
      'title',
      'page_start',
      'page_end',
      'content_md',
      'url',
    ]);
  });

  it('stores a section url and leaves it empty for sections without one', () => {
    const db = openReferencesDb(':memory:');
    writeReference(db, {
      id: 'r',
      title: 'R',
      edition: '2026',
      summary: 'S',
      url: 'https://example.com/r',
      sections: [
        {
          sectionId: 'a',
          parentId: null,
          title: 'A',
          location: { kind: 'webpage', url: 'https://example.com/a' },
          contentMd: 'a',
        },
        {
          sectionId: 'b',
          parentId: null,
          title: 'B',
          location: { kind: 'webpage' },
          contentMd: 'b',
        },
      ],
    });
    expect(
      db
        .prepare('SELECT section_id, url FROM sections ORDER BY position')
        .all(),
    ).toEqual([
      { section_id: 'a', url: 'https://example.com/a' },
      { section_id: 'b', url: null },
    ]);
  });
});
