import { auditLibrary } from './audit';
import { openReferencesDb, writeReference } from './referencesDb';

const BACKGROUND =
  'Hypertension raises the risk of stroke, heart attack, heart failure and kidney disease. '.repeat(
    6,
  );

function library(
  sections: {
    sectionId: string;
    parentId: string | null;
    contentMd: string;
  }[],
  summary = 'Blood pressure goals',
) {
  const db = openReferencesDb(':memory:');
  writeReference(db, {
    id: 'guide',
    title: 'Guide',
    edition: '2026',
    summary,
    url: 'https://example.com/guide',
    sections: [
      ...sections,
      { sectionId: 'background', parentId: null, contentMd: BACKGROUND },
    ].map((s) => ({
      ...s,
      title: s.sectionId,
      location: { kind: 'webpage' },
    })),
  });
  return db;
}

describe('auditLibrary', () => {
  it('finds nothing in a clean library', () => {
    expect(
      auditLibrary(
        library([
          { sectionId: 'goals', parentId: null, contentMd: '' },
          { sectionId: 'targets', parentId: 'goals', contentMd: 'Below 130.' },
        ]),
      ),
    ).toEqual([]);
  });

  it('reports a section with no text and no subsections', () => {
    expect(
      auditLibrary(
        library([{ sectionId: 'appendix', parentId: null, contentMd: '' }]),
      ),
    ).toEqual([
      {
        check: 'dead-end',
        reference: 'guide',
        section: 'appendix',
        detail: 'no text and no subsections',
      },
    ]);
  });

  it('reports a section whose text is only links', () => {
    expect(
      auditLibrary(
        library([
          {
            sectionId: 'contents',
            parentId: null,
            contentMd:
              '*   [5.1 Renal Toxicity](#section-5.1)\n*   [5.2 Anaphylaxis](#section-5.2)',
          },
        ]),
      ),
    ).toEqual([
      {
        check: 'links-only',
        reference: 'guide',
        section: 'contents',
        detail: 'text is only links',
      },
    ]);
  });

  it('reports html tags left in the text', () => {
    expect(
      auditLibrary(
        library([
          {
            sectionId: 'schedule',
            parentId: null,
            contentMd: '| Vaccine | Dose |\n| HepB<br>Hepatitis B | 3 |',
          },
        ]),
      ),
    ).toEqual([
      {
        check: 'html-tags',
        reference: 'guide',
        section: 'schedule',
        detail: '<br>',
      },
    ]);
  });

  it('reports a section repeating the text of an earlier one', () => {
    expect(
      auditLibrary(
        library([
          { sectionId: 'summary', parentId: null, contentMd: 'Below 130.' },
          { sectionId: 'goals', parentId: null, contentMd: 'Below 130.' },
        ]),
      ),
    ).toEqual([
      {
        check: 'duplicate-text',
        reference: 'guide',
        section: 'goals',
        detail: 'same text as guide/summary',
      },
    ]);
  });

  it('reports a section whose parent does not exist', () => {
    expect(
      auditLibrary(
        library([
          { sectionId: 'targets', parentId: 'goals', contentMd: 'Below 130.' },
        ]),
      ),
    ).toEqual([
      {
        check: 'missing-parent',
        reference: 'guide',
        section: 'targets',
        detail: 'parent goals not found',
      },
    ]);
  });

  it('reports unreadable characters', () => {
    expect(
      auditLibrary(
        library([
          {
            sectionId: 'goals',
            parentId: null,
            contentMd: 'Below 130 \ufffd.',
          },
        ]),
      ),
    ).toEqual([
      {
        check: 'replacement-character',
        reference: 'guide',
        section: 'goals',
        detail: 'text has \ufffd',
      },
    ]);
  });

  it('reports a search index that has fallen out of step with the sections', () => {
    const db = library([
      { sectionId: 'goals', parentId: null, contentMd: 'Below 130.' },
    ]);
    db.exec('DELETE FROM sections_fts');

    expect(auditLibrary(db)).toEqual([
      {
        check: 'search-index',
        reference: '(library)',
        section: null,
        detail: '2 sections, 0 in the section search index',
      },
    ]);
  });

  it('reports a reference with under 500 characters of text in all', () => {
    const db = openReferencesDb(':memory:');
    writeReference(db, {
      id: 'cdc-page',
      title: 'CDC page',
      edition: '2025',
      summary: 'Symptoms',
      url: 'https://example.com/cdc',
      sections: [
        {
          sectionId: 'opening-text',
          parentId: null,
          title: 'Opening text',
          location: { kind: 'webpage' },
          contentMd: 'Content provided and maintained by the CDC.',
        },
      ],
    });

    expect(auditLibrary(db)).toEqual([
      {
        check: 'short-reference',
        reference: 'cdc-page',
        section: null,
        detail: '43 characters of text',
      },
    ]);
  });
});
