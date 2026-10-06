import {
  Library,
  auditLibrary,
  deadEnds,
  duplicateText,
  emptyLibrary,
  htmlTags,
  linksOnly,
  missingParents,
  replacementCharacters,
  searchIndex,
  shortReferences,
} from './audit';
import { openReferencesDb, writeReference } from './referencesDb';

const NOTHING: Library = {
  references: [],
  sections: [],
  referenceIndex: [],
  sectionIndex: [],
};

const BACKGROUND =
  'Hypertension raises the risk of stroke, heart attack, heart failure and kidney disease. '.repeat(
    6,
  );

describe('missingParents', () => {
  it('reports a section whose parent does not exist', () => {
    expect(
      missingParents({
        ...NOTHING,
        sections: [
          {
            reference: 'guide',
            section: 'targets',
            parent: 'goals',
            title: 'Targets',
            text: 'Below 130.',
          },
        ],
      }),
    ).toEqual([
      {
        check: 'missing-parent',
        reference: 'guide',
        section: 'targets',
        detail: 'parent goals not found',
      },
    ]);
  });
});

describe('deadEnds', () => {
  it('reports a section with no text and no subsections, not an empty parent', () => {
    expect(
      deadEnds({
        ...NOTHING,
        sections: [
          {
            reference: 'guide',
            section: 'goals',
            parent: null,
            title: 'Goals',
            text: '',
          },
          {
            reference: 'guide',
            section: 'targets',
            parent: 'goals',
            title: 'Targets',
            text: 'Below 130.',
          },
          {
            reference: 'guide',
            section: 'appendix',
            parent: null,
            title: 'Appendix',
            text: '',
          },
        ],
      }),
    ).toEqual([
      {
        check: 'dead-end',
        reference: 'guide',
        section: 'appendix',
        detail: 'no text and no subsections',
      },
    ]);
  });
});

describe('linksOnly', () => {
  it('reports a section whose text is only links', () => {
    expect(
      linksOnly({
        ...NOTHING,
        sections: [
          {
            reference: 'guide',
            section: 'contents',
            parent: null,
            title: 'Contents',
            text: '*   [5.1 Renal Toxicity](#section-5.1)\n*   [5.2 Anaphylaxis](#section-5.2)',
          },
          {
            reference: 'guide',
            section: 'goals',
            parent: null,
            title: 'Goals',
            text: 'See [the table](#table-1) for targets.',
          },
        ],
      }),
    ).toEqual([
      {
        check: 'links-only',
        reference: 'guide',
        section: 'contents',
        detail: 'text is only links',
      },
    ]);
  });
});

describe('htmlTags', () => {
  it('reports each html tag left in a section once', () => {
    expect(
      htmlTags({
        ...NOTHING,
        sections: [
          {
            reference: 'guide',
            section: 'schedule',
            parent: null,
            title: 'Schedule',
            text: '| HepB<br>Hepatitis B | 3<br><em>doses</em> |',
          },
        ],
      }),
    ).toEqual([
      {
        check: 'html-tags',
        reference: 'guide',
        section: 'schedule',
        detail: '<br> <em>',
      },
    ]);
  });
});

describe('replacementCharacters', () => {
  it('reports a section with an unreadable character', () => {
    expect(
      replacementCharacters({
        ...NOTHING,
        sections: [
          {
            reference: 'guide',
            section: 'goals',
            parent: null,
            title: 'Goals',
            text: 'Below 130 \ufffd 5.',
          },
        ],
      }),
    ).toEqual([
      {
        check: 'replacement-character',
        reference: 'guide',
        section: 'goals',
        detail: 'text has \ufffd',
      },
    ]);
  });
});

describe('duplicateText', () => {
  it('reports a section repeating the text of an earlier one', () => {
    expect(
      duplicateText({
        ...NOTHING,
        sections: [
          {
            reference: 'guide',
            section: 'summary',
            parent: null,
            title: 'Summary',
            text: 'Below 130.',
          },
          {
            reference: 'other',
            section: 'goals',
            parent: null,
            title: 'Goals',
            text: 'Below 130. ',
          },
        ],
      }),
    ).toEqual([
      {
        check: 'duplicate-text',
        reference: 'other',
        section: 'goals',
        detail: 'same text as guide/summary',
      },
    ]);
  });
});

describe('shortReferences', () => {
  it('reports a reference with under 500 characters of text in all', () => {
    expect(
      shortReferences({
        ...NOTHING,
        references: [
          { id: 'cdc-page', title: 'CDC page', summary: 'Symptoms' },
        ],
        sections: [
          {
            reference: 'cdc-page',
            section: 'opening-text',
            parent: null,
            title: 'Opening text',
            text: 'Content provided and maintained by the CDC.',
          },
        ],
      }),
    ).toEqual([
      {
        check: 'short-reference',
        reference: 'cdc-page',
        section: null,
        detail: '43 characters of text',
      },
    ]);
  });
});

describe('emptyLibrary', () => {
  it('reports a library with no references', () => {
    expect(emptyLibrary(NOTHING)).toEqual([
      {
        check: 'empty-library',
        reference: '(library)',
        section: null,
        detail: 'no references',
      },
    ]);
  });
});

describe('searchIndex', () => {
  it('reports rows missing from, stale in or left over in either search index', () => {
    expect(
      searchIndex({
        references: [{ id: 'guide', title: 'Guide', summary: 'BP goals' }],
        referenceIndex: [
          { id: 'guide', title: 'Guide', summary: 'Old summary' },
          { id: 'gone', title: 'Gone', summary: 'Removed' },
        ],
        sections: [
          {
            reference: 'guide',
            section: 'goals',
            parent: null,
            title: 'Goals',
            text: 'Below 130.',
          },
          {
            reference: 'guide',
            section: 'targets',
            parent: null,
            title: 'Targets',
            text: 'Below 90.',
          },
        ],
        sectionIndex: [
          {
            reference: 'guide',
            section: 'goals',
            parent: null,
            title: 'Goals',
            text: 'Below 140.',
          },
          {
            reference: 'guide',
            section: 'old',
            parent: null,
            title: 'Old',
            text: 'Gone.',
          },
        ],
      }),
    ).toEqual([
      {
        check: 'search-index',
        reference: 'guide',
        section: null,
        detail:
          'missing from the reference search index or indexed with another title or summary',
      },
      {
        check: 'search-index',
        reference: 'gone',
        section: null,
        detail: 'in the reference search index but not in the library',
      },
      {
        check: 'search-index',
        reference: 'guide',
        section: 'goals',
        detail:
          'missing from the section search index or indexed with other text',
      },
      {
        check: 'search-index',
        reference: 'guide',
        section: 'targets',
        detail:
          'missing from the section search index or indexed with other text',
      },
      {
        check: 'search-index',
        reference: 'guide',
        section: 'old',
        detail: 'in the section search index but not in the library',
      },
    ]);
  });
});

describe('auditLibrary', () => {
  it('finds nothing in a clean library', () => {
    const db = openReferencesDb(':memory:');
    writeReference(db, {
      id: 'guide',
      title: 'Guide',
      edition: '2026',
      summary: 'Blood pressure goals',
      url: 'https://example.com/guide',
      sections: [
        {
          sectionId: 'goals',
          parentId: null,
          title: 'Goals',
          location: { kind: 'webpage' },
          contentMd: '',
        },
        {
          sectionId: 'background',
          parentId: 'goals',
          title: 'Background',
          location: { kind: 'webpage' },
          contentMd: BACKGROUND,
        },
      ],
    });

    expect(auditLibrary(db)).toEqual([]);
  });

  it('runs the checks over what it loaded from the database', () => {
    const db = openReferencesDb(':memory:');
    writeReference(db, {
      id: 'guide',
      title: 'Guide',
      edition: '2026',
      summary: 'Blood pressure goals',
      url: 'https://example.com/guide',
      sections: [
        {
          sectionId: 'background',
          parentId: null,
          title: 'Background',
          location: { kind: 'webpage' },
          contentMd: BACKGROUND,
        },
      ],
    });
    db.exec("DELETE FROM sections_fts WHERE section_id = 'background'");

    expect(auditLibrary(db)).toEqual([
      {
        check: 'search-index',
        reference: 'guide',
        section: 'background',
        detail:
          'missing from the section search index or indexed with other text',
      },
    ]);
  });
});
