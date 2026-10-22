import {
  findInReference,
  getOutline,
  listReferences,
  readChunk,
  searchReferences,
} from './query';
import { openReferencesDb, writeReference } from './referencesDb';
import { Block, blocksToDocument } from './sections';

function addReference(
  db: ReturnType<typeof openReferencesDb>,
  id: string,
  title: string,
  summary: string,
  blocks: Block[],
) {
  writeReference(db, {
    id,
    title,
    edition: '2025',
    summary,
    url: `https://example.com/${id}`,
    ...blocksToDocument(blocks),
  });
}

function seededDb() {
  const db = openReferencesDb(':memory:');
  addReference(
    db,
    'va-dod-hypertension',
    'VA-DoD Hypertension Guideline',
    'Adults; diagnosis, BP goals, drug choice',
    [
      { kind: 'heading', level: 1, text: 'IX. Recommendations' },
      { kind: 'heading', level: 2, text: 'Blood Pressure Goals' },
      { kind: 'text', text: 'Aim for a systolic goal below 130 mmHg.' },
      { kind: 'heading', level: 3, text: 'Target Groups' },
      { kind: 'text', text: 'Older adults.' },
      { kind: 'heading', level: 2, text: 'Drug Therapy' },
      {
        kind: 'text',
        text: 'Thiazides first. Watch for orthostatic hypotension.',
      },
      { kind: 'heading', level: 2, text: 'Long Table' },
      { kind: 'text', text: 'x'.repeat(9990) },
      { kind: 'text', text: 'Orthostatic checks at every visit.' },
    ],
  );
  addReference(
    db,
    'uspstf-a-and-b',
    'USPSTF A and B Recommendations',
    'Screening and prevention',
    [
      { kind: 'heading', level: 1, text: 'Screening' },
      {
        kind: 'text',
        text: 'Screen adults for high blood pressure. Treat naïve patients.',
      },
    ],
  );
  return db;
}

function catalogDb() {
  const db = openReferencesDb(':memory:');
  addReference(
    db,
    'va-dod-ckd',
    'VA-DoD Chronic Kidney Disease Guideline',
    'Kidney disease in adults: eGFR testing, blood pressure, and kidney-protecting medicines',
    [],
  );
  addReference(
    db,
    'va-dod-hypertension',
    'VA-DoD Hypertension Guideline',
    'High blood pressure in adults: diagnosis, goals, and medicines',
    [],
  );
  addReference(
    db,
    'cdc-pertussis-treatment',
    'Treatment of Whooping Cough',
    'Antibiotics for pertussis and preventing spread',
    [],
  );
  return db;
}

function catalogOf21() {
  const db = openReferencesDb(':memory:');
  for (const n of [
    '01',
    '02',
    '03',
    '04',
    '05',
    '06',
    '07',
    '08',
    '09',
    '10',
    '11',
    '12',
    '13',
    '14',
    '15',
    '16',
    '17',
    '18',
    '19',
    '20',
    '21',
  ]) {
    addReference(db, `measles-${n}`, `Measles page ${n}`, 'About measles', []);
  }
  return db;
}

const hypertension = {
  id: 'va-dod-hypertension',
  title: 'VA-DoD Hypertension Guideline',
  edition: '2025',
  summary: 'Adults; diagnosis, BP goals, drug choice',
  url: 'https://example.com/va-dod-hypertension',
};

describe('listReferences', () => {
  it('lists the first page of references alphabetically by title with the total', () => {
    expect(listReferences(seededDb())).toEqual({
      references: [
        {
          id: 'uspstf-a-and-b',
          title: 'USPSTF A and B Recommendations',
          edition: '2025',
          summary: 'Screening and prevention',
          url: 'https://example.com/uspstf-a-and-b',
        },
        hypertension,
      ],
      total: 2,
      page: 1,
      pageSize: 50,
    });
  });

  it('returns an empty page past the end, still with the total', () => {
    expect(listReferences(seededDb(), 3)).toEqual({
      references: [],
      total: 2,
      page: 3,
      pageSize: 50,
    });
  });

  it('returns an empty page for a page number beyond what sqlite can offset', () => {
    expect(listReferences(seededDb(), 1e20)).toEqual({
      references: [],
      total: 2,
      page: 1e20,
      pageSize: 50,
    });
  });
});

describe('searchReferences', () => {
  it('ranks a title match above a summary mention, one row per reference', () => {
    expect(
      searchReferences(catalogDb(), ['hypertension', 'blood pressure']),
    ).toEqual({
      references: [
        {
          id: 'va-dod-hypertension',
          title: 'VA-DoD Hypertension Guideline',
          edition: '2025',
          summary:
            'High blood pressure in adults: diagnosis, goals, and medicines',
          url: 'https://example.com/va-dod-hypertension',
        },
        {
          id: 'va-dod-ckd',
          title: 'VA-DoD Chronic Kidney Disease Guideline',
          edition: '2025',
          summary:
            'Kidney disease in adults: eGFR testing, blood pressure, and kidney-protecting medicines',
          url: 'https://example.com/va-dod-ckd',
        },
      ],
      total: 2,
      page: 1,
      pageSize: 20,
    });
  });

  it('matches other forms of a word', () => {
    expect(searchReferences(catalogDb(), ['antibiotic treatments'])).toEqual({
      references: [
        {
          id: 'cdc-pertussis-treatment',
          title: 'Treatment of Whooping Cough',
          edition: '2025',
          summary: 'Antibiotics for pertussis and preventing spread',
          url: 'https://example.com/cdc-pertussis-treatment',
        },
      ],
      total: 1,
      page: 1,
      pageSize: 20,
    });
  });

  it('pages twenty references at a time with the total', () => {
    expect(searchReferences(catalogOf21(), ['measles'], 2)).toEqual({
      references: [
        {
          id: 'measles-21',
          title: 'Measles page 21',
          edition: '2025',
          summary: 'About measles',
          url: 'https://example.com/measles-21',
        },
      ],
      total: 21,
      page: 2,
      pageSize: 20,
    });
  });

  it('returns an empty page for a page number beyond what sqlite can offset', () => {
    expect(searchReferences(catalogOf21(), ['measles'], 1e20)).toEqual({
      references: [],
      total: 21,
      page: 1e20,
      pageSize: 20,
    });
  });

  it('treats quotes and operators in a term as plain words', () => {
    expect(searchReferences(catalogDb(), ['"whooping" OR'])).toEqual({
      references: [
        {
          id: 'cdc-pertussis-treatment',
          title: 'Treatment of Whooping Cough',
          edition: '2025',
          summary: 'Antibiotics for pertussis and preventing spread',
          url: 'https://example.com/cdc-pertussis-treatment',
        },
      ],
      total: 1,
      page: 1,
      pageSize: 20,
    });
  });

  it('finds nothing for terms with no words', () => {
    expect(searchReferences(catalogDb(), ['<', ' '])).toEqual({
      references: [],
      total: 0,
      page: 1,
      pageSize: 20,
    });
  });
});

describe('getOutline', () => {
  it('returns the top two levels of a reference with subsection counts below that', () => {
    expect(getOutline(seededDb(), 'va-dod-hypertension')).toEqual({
      kind: 'found',
      value: {
        reference: hypertension,
        section: null,
        sections: [
          {
            sectionId: 'ix-recommendations',
            title: 'IX. Recommendations',
            chars: 0,
            chunks: 0,
            subsections: [
              {
                sectionId: 'blood-pressure-goals',
                title: 'Blood Pressure Goals',
                chars: 39,
                chunks: 1,
                subsectionCount: 1,
              },
              {
                sectionId: 'drug-therapy',
                title: 'Drug Therapy',
                chars: 51,
                chunks: 1,
                subsectionCount: 0,
              },
              {
                sectionId: 'long-table',
                title: 'Long Table',
                chars: 10026,
                chunks: 2,
                subsectionCount: 0,
              },
            ],
          },
        ],
      },
    });
  });

  it('expands the branch under a section id, led by that section itself', () => {
    expect(
      getOutline(seededDb(), 'va-dod-hypertension', 'blood-pressure-goals'),
    ).toEqual({
      kind: 'found',
      value: {
        reference: hypertension,
        section: {
          sectionId: 'blood-pressure-goals',
          title: 'Blood Pressure Goals',
          chars: 39,
          chunks: 1,
        },
        sections: [
          {
            sectionId: 'target-groups',
            title: 'Target Groups',
            chars: 13,
            chunks: 1,
            subsections: [],
          },
        ],
      },
    });
  });

  it('answers no-reference for an unknown reference id', () => {
    expect(getOutline(seededDb(), 'nope')).toEqual({ kind: 'no-reference' });
  });

  it('answers no-section for an unknown section id', () => {
    expect(getOutline(seededDb(), 'va-dod-hypertension', 'nope')).toEqual({
      kind: 'no-section',
    });
  });
});

describe('readChunk', () => {
  it('returns one chunk of a section with its number and the section chunk count', () => {
    expect(
      readChunk(seededDb(), 'va-dod-hypertension', 'long-table', 2),
    ).toEqual({
      kind: 'found',
      value: {
        reference: hypertension,
        section: { sectionId: 'long-table', title: 'Long Table' },
        chunk: 2,
        chunks: 2,
        text: 'Orthostatic checks at every visit.',
      },
    });
  });

  it('answers no-reference, no-section and no-chunk for unknown ids', () => {
    expect(readChunk(seededDb(), 'nope', 'long-table', 1)).toEqual({
      kind: 'no-reference',
    });
    expect(readChunk(seededDb(), 'va-dod-hypertension', 'nope', 1)).toEqual({
      kind: 'no-section',
    });
    expect(
      readChunk(seededDb(), 'va-dod-hypertension', 'long-table', 3),
    ).toEqual({ kind: 'no-chunk' });
    expect(
      readChunk(seededDb(), 'va-dod-hypertension', 'ix-recommendations', 1),
    ).toEqual({ kind: 'no-chunk' });
  });
});

describe('findInReference', () => {
  it('points to the chunks of one reference matching any term, in reading order, with an excerpt of each', () => {
    expect(
      findInReference(seededDb(), 'va-dod-hypertension', ['orthostatic']),
    ).toEqual({
      kind: 'found',
      value: {
        matches: [
          {
            sectionId: 'drug-therapy',
            title: 'Drug Therapy',
            chunk: 1,
            count: 1,
            excerpt: 'Thiazides first. Watch for orthostatic hypotension.',
          },
          {
            sectionId: 'long-table',
            title: 'Long Table',
            chunk: 2,
            count: 1,
            excerpt: 'Orthostatic checks at every visit.',
          },
        ],
      },
    });
  });

  it('matches a multi-word term when all its words appear, and ignores other references', () => {
    expect(
      findInReference(seededDb(), 'va-dod-hypertension', ['goal systolic']),
    ).toEqual({
      kind: 'found',
      value: {
        matches: [
          {
            sectionId: 'blood-pressure-goals',
            title: 'Blood Pressure Goals',
            chunk: 1,
            count: 2,
            excerpt: 'Aim for a systolic goal below 130 mmHg.',
          },
        ],
      },
    });
  });

  it('does not match a multi-word term whose words sit in different chunks', () => {
    expect(
      findInReference(seededDb(), 'va-dod-hypertension', ['goal thiazides']),
    ).toEqual({ kind: 'found', value: { matches: [] } });
  });

  it('matches other forms of a word', () => {
    expect(
      findInReference(seededDb(), 'uspstf-a-and-b', ['screening']),
    ).toEqual({
      kind: 'found',
      value: {
        matches: [
          {
            sectionId: 'screening',
            title: 'Screening',
            chunk: 1,
            count: 1,
            excerpt:
              'Screen adults for high blood pressure. Treat naïve patients.',
          },
        ],
      },
    });
  });

  it('treats quotes and operators in a term as plain text', () => {
    expect(
      findInReference(seededDb(), 'uspstf-a-and-b', ['"screen" adults*']),
    ).toEqual({
      kind: 'found',
      value: {
        matches: [
          {
            sectionId: 'screening',
            title: 'Screening',
            chunk: 1,
            count: 2,
            excerpt:
              'Screen adults for high blood pressure. Treat naïve patients.',
          },
        ],
      },
    });
  });

  it('matches a word typed with a separate accent mark', () => {
    expect(
      findInReference(seededDb(), 'uspstf-a-and-b', ['nai\u0308ve']),
    ).toEqual({
      kind: 'found',
      value: {
        matches: [
          {
            sectionId: 'screening',
            title: 'Screening',
            chunk: 1,
            count: 1,
            excerpt:
              'Screen adults for high blood pressure. Treat naïve patients.',
          },
        ],
      },
    });
  });

  it('finds nothing for terms with no words', () => {
    expect(findInReference(seededDb(), 'uspstf-a-and-b', ['<'])).toEqual({
      kind: 'found',
      value: { matches: [] },
    });
  });

  it('answers no-reference for an unknown reference id', () => {
    expect(findInReference(seededDb(), 'nope', ['screen'])).toEqual({
      kind: 'no-reference',
    });
  });
});
