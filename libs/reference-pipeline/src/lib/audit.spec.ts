import {
  Library,
  auditLibrary,
  deadEnds,
  duplicateText,
  emptyLibrary,
  missingParents,
  replacementCharacters,
  shortReferences,
} from './audit';
import { openReferencesDb, writeReference } from './referencesDb';

const NOTHING: Library = {
  references: [],
  sections: [],
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
            text: '',
          },
          {
            reference: 'guide',
            section: 'targets',
            parent: 'goals',
            text: 'Below 130.',
          },
          {
            reference: 'guide',
            section: 'appendix',
            parent: null,
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
            text: 'Below 130.',
          },
          {
            reference: 'other',
            section: 'goals',
            parent: null,
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
        references: [{ id: 'cdc-page' }],
        sections: [
          {
            reference: 'cdc-page',
            section: 'opening-text',
            parent: null,
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
        {
          sectionId: 'appendix',
          parentId: null,
          title: 'Appendix',
          location: { kind: 'webpage' },
          contentMd: '',
        },
      ],
    });

    expect(auditLibrary(db)).toEqual([
      {
        check: 'dead-end',
        reference: 'guide',
        section: 'appendix',
        detail: 'no text and no subsections',
      },
    ]);
  });
});
