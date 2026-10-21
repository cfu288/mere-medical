import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  openReferencesDb,
  openReferencesDbReadOnly,
  writeReference,
} from './referencesDb';

function newLibraryPath(): string {
  return join(mkdtempSync(join(tmpdir(), 'references-')), 'references.db');
}

describe('openReferencesDb', () => {
  it('stamps the library with schema version 1', () => {
    const db = openReferencesDb(':memory:');

    expect(db.prepare('PRAGMA user_version').get()).toEqual({
      user_version: 1,
    });
  });
});

describe('openReferencesDbReadOnly', () => {
  it('reads a built library and refuses to write to it', () => {
    const path = newLibraryPath();
    const built = openReferencesDb(path);
    writeReference(built, {
      id: 'measles',
      title: 'Measles',
      edition: '2026',
      summary: 'Vaccine schedule',
      url: 'https://example.com/measles',
      markdown: 'Two doses.',
      sections: [],
      chunks: [],
    });
    built.close();
    const db = openReferencesDbReadOnly(path);

    expect(db.prepare('SELECT id FROM documents').all()).toEqual([
      { id: 'measles' },
    ]);
    expect(() => db.exec("DELETE FROM documents WHERE id = 'measles'")).toThrow(
      'attempt to write a readonly database',
    );
  });

  it('throws when no file is at the path', () => {
    expect(() => openReferencesDbReadOnly('/no/such/references.db')).toThrow(
      'No reference library file at /no/such/references.db',
    );
  });

  it('throws when the path is a folder', () => {
    expect(() => openReferencesDbReadOnly('/')).toThrow(
      'No reference library file at /',
    );
  });

  it('throws when the file has another schema version', () => {
    const path = newLibraryPath();
    writeFileSync(path, '');

    expect(() => openReferencesDbReadOnly(path)).toThrow(
      'has schema version 0, expected 1',
    );
  });

  it('throws when the library holds no references', () => {
    const path = newLibraryPath();
    openReferencesDb(path).close();

    expect(() => openReferencesDbReadOnly(path)).toThrow('holds no references');
  });
});

describe('writeReference', () => {
  it('stores the reference with its markdown and its sections', () => {
    const db = openReferencesDb(':memory:');
    writeReference(db, {
      id: 'measles',
      title: 'Measles',
      edition: '2026',
      summary: 'Vaccine schedule',
      url: 'https://example.com/measles',
      markdown: '# Doses\n\nTwo doses.',
      sections: [
        {
          sectionId: 'doses',
          parentId: null,
          title: 'Doses',
          textStart: 9,
          textEnd: 19,
        },
      ],
      chunks: [{ sectionId: 'doses', chunk: 1, text: 'Two doses.' }],
    });

    expect(
      db
        .prepare(
          'SELECT id, title, edition, summary, url, content_md, sections FROM documents',
        )
        .all(),
    ).toEqual([
      {
        id: 'measles',
        title: 'Measles',
        edition: '2026',
        summary: 'Vaccine schedule',
        url: 'https://example.com/measles',
        content_md: '# Doses\n\nTwo doses.',
        sections:
          '[{"sectionId":"doses","parentId":null,"title":"Doses","textStart":9,"textEnd":19}]',
      },
    ]);
  });

  it('finds a written reference by a word in its title or summary', () => {
    const db = openReferencesDb(':memory:');
    writeReference(db, {
      id: 'measles',
      title: 'Measles',
      edition: '2026',
      summary: 'Vaccine schedule',
      url: 'https://example.com/measles',
      markdown: 'Rash and fever.',
      sections: [],
      chunks: [],
    });

    expect([
      db
        .prepare(
          "SELECT id FROM documents_fts WHERE documents_fts MATCH 'vaccine'",
        )
        .all(),
      db
        .prepare(
          "SELECT id FROM documents_fts WHERE documents_fts MATCH 'rash'",
        )
        .all(),
    ]).toEqual([[{ id: 'measles' }], []]);
  });

  it('finds the chunks of one reference that mention a word, and only that reference', () => {
    const db = openReferencesDb(':memory:');
    writeReference(db, {
      id: 'ckd',
      title: 'CKD',
      edition: '2025',
      summary: 'Kidney disease',
      url: 'https://example.com/ckd',
      markdown: '# Diet\n\nLimit potassium.',
      sections: [],
      chunks: [
        { sectionId: 'diet', chunk: 1, text: 'Limit potassium.' },
        { sectionId: 'diet', chunk: 2, text: 'Limit salt.' },
      ],
    });
    writeReference(db, {
      id: 'hypertension',
      title: 'Hypertension',
      edition: '2026',
      summary: 'Blood pressure',
      url: 'https://example.com/htn',
      markdown: '# Diet\n\nEat potassium.',
      sections: [],
      chunks: [{ sectionId: 'diet', chunk: 1, text: 'Eat potassium.' }],
    });

    expect(
      db
        .prepare(
          "SELECT section_id, chunk, text FROM chunks_fts WHERE chunks_fts MATCH 'potassium' AND document_id = 'ckd'",
        )
        .all(),
    ).toEqual([{ section_id: 'diet', chunk: 1, text: 'Limit potassium.' }]);
  });

  it('stores each chunk number as an integer', () => {
    const db = openReferencesDb(':memory:');
    writeReference(db, {
      id: 'ckd',
      title: 'CKD',
      edition: '2025',
      summary: 'Kidney disease',
      url: 'https://example.com/ckd',
      markdown: '# Diet\n\nLimit potassium.',
      sections: [],
      chunks: [{ sectionId: 'diet', chunk: 1, text: 'Limit potassium.' }],
    });

    expect(
      db.prepare('SELECT typeof(chunk) AS type FROM chunks_fts').all(),
    ).toEqual([{ type: 'integer' }]);
  });
});
