import { openReferencesDb, writeReference } from './referencesDb';

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
          pdfPages: null,
          textStart: 9,
          textEnd: 19,
        },
      ],
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
          '[{"sectionId":"doses","parentId":null,"title":"Doses","pdfPages":null,"textStart":9,"textEnd":19}]',
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
});
