import {
  deleteReference,
  openReferencesDb,
  writeReference,
} from './referencesDb';

describe('writeReference', () => {
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

  it('finds a written reference and its sections by search, and nothing once deleted', () => {
    const db = openReferencesDb(':memory:');
    writeReference(db, {
      id: 'measles',
      title: 'Measles',
      edition: '2026',
      summary: 'Vaccine schedule',
      url: 'https://example.com/measles',
      sections: [
        {
          sectionId: 'doses',
          parentId: null,
          title: 'Doses',
          location: { kind: 'webpage' },
          contentMd: 'Two doses of vaccine.',
        },
      ],
    });
    const search = () => ({
      references: db
        .prepare(
          "SELECT id FROM documents_fts WHERE documents_fts MATCH 'vaccine'",
        )
        .all(),
      sections: db
        .prepare(
          "SELECT document_id, section_id FROM sections_fts WHERE sections_fts MATCH 'vaccine'",
        )
        .all(),
    });

    expect(search()).toEqual({
      references: [{ id: 'measles' }],
      sections: [{ document_id: 'measles', section_id: 'doses' }],
    });
    deleteReference(db, 'measles');
    expect(search()).toEqual({ references: [], sections: [] });
  });

  it('searches the new text of a row that was edited in place', () => {
    const db = openReferencesDb(':memory:');
    writeReference(db, {
      id: 'measles',
      title: 'Measles',
      edition: '2026',
      summary: 'Vaccine schedule',
      url: 'https://example.com/measles',
      sections: [
        {
          sectionId: 'doses',
          parentId: null,
          title: 'Doses',
          location: { kind: 'webpage' },
          contentMd: 'Two doses.',
        },
      ],
    });
    db.exec(`
      UPDATE documents SET summary = 'Booster schedule' WHERE id = 'measles';
      UPDATE sections SET content_md = 'One booster.' WHERE section_id = 'doses';
    `);

    expect([
      db
        .prepare(
          "SELECT id FROM documents_fts WHERE documents_fts MATCH 'booster'",
        )
        .all(),
      db
        .prepare(
          "SELECT id FROM documents_fts WHERE documents_fts MATCH 'vaccine'",
        )
        .all(),
      db
        .prepare(
          "SELECT section_id FROM sections_fts WHERE sections_fts MATCH 'booster'",
        )
        .all(),
      db
        .prepare(
          "SELECT section_id FROM sections_fts WHERE sections_fts MATCH 'two'",
        )
        .all(),
    ]).toEqual([[{ id: 'measles' }], [], [{ section_id: 'doses' }], []]);
  });
});
