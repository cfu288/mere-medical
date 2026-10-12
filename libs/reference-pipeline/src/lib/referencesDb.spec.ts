import { openReferencesDb, writeReference } from './referencesDb';

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

  it('finds a written reference and its sections by search', () => {
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

    expect({
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
    }).toEqual({
      references: [{ id: 'measles' }],
      sections: [{ document_id: 'measles', section_id: 'doses' }],
    });
  });
});
