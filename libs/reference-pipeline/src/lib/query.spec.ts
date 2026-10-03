import {
  findInReference,
  getOutline,
  listReferences,
  readSection,
  searchReferences,
} from './query';
import { openReferencesDb, writeReference } from './referencesDb';

function seededDb() {
  const db = openReferencesDb(':memory:');
  writeReference(db, {
    id: 'va-dod-hypertension',
    title: 'VA-DoD Hypertension Guideline',
    edition: '2026',
    summary: 'Adults; diagnosis, BP goals, drug choice',
    url: 'https://example.com/htn.pdf',
    sections: [
      {
        sectionId: 'ix-recommendations',
        parentId: null,
        title: 'IX. Recommendations',
        location: { kind: 'pages', start: 26, end: 26 },
        contentMd: '',
      },
      {
        sectionId: 'blood-pressure-goals',
        parentId: 'ix-recommendations',
        title: 'Blood Pressure Goals',
        location: { kind: 'pages', start: 31, end: 33 },
        contentMd:
          'We recommend a systolic blood pressure goal of <130 mmHg.\n\nStanding blood pressure matters for orthostatic symptoms.',
      },
      {
        sectionId: 'target-groups',
        parentId: 'blood-pressure-goals',
        title: 'Target Groups',
        location: { kind: 'pages', start: 34, end: 34 },
        contentMd: 'Older adults.',
      },
      {
        sectionId: 'drug-therapy',
        parentId: 'ix-recommendations',
        title: 'Drug Therapy',
        location: { kind: 'pages', start: 36, end: 40 },
        contentMd: 'Thiazides first. Watch for orthostatic hypotension.',
      },
    ],
  });
  writeReference(db, {
    id: 'uspstf-a-and-b',
    title: 'USPSTF A and B Recommendations',
    edition: 'Updated continuously',
    summary: 'Screening and prevention',
    url: 'https://example.com/ab',
    sections: [
      {
        sectionId: 'screening',
        parentId: null,
        title: 'Screening',
        location: { kind: 'webpage' },
        contentMd: 'Screen adults for high blood pressure.',
      },
    ],
  });
  return db;
}

function catalogDb() {
  const db = openReferencesDb(':memory:');
  const reference = (id: string, title: string, summary: string) =>
    writeReference(db, {
      id,
      title,
      edition: '2025',
      summary,
      url: `https://example.com/${id}`,
      sections: [],
    });
  reference(
    'va-dod-ckd',
    'VA-DoD Chronic Kidney Disease Guideline',
    'Kidney disease in adults: eGFR testing, blood pressure, and kidney-protecting medicines',
  );
  reference(
    'va-dod-hypertension',
    'VA-DoD Hypertension Guideline',
    'High blood pressure in adults: diagnosis, goals, and medicines',
  );
  reference(
    'cdc-pertussis-treatment',
    'Treatment of Whooping Cough',
    'Antibiotics for pertussis and preventing spread',
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
    writeReference(db, {
      id: `measles-${n}`,
      title: `Measles page ${n}`,
      edition: '2025',
      summary: 'About measles',
      url: `https://example.com/measles-${n}`,
      sections: [],
    });
  }
  return db;
}

describe('listReferences', () => {
  it('lists the first page of references alphabetically by title with the total', () => {
    expect(listReferences(seededDb())).toEqual({
      references: [
        {
          id: 'uspstf-a-and-b',
          title: 'USPSTF A and B Recommendations',
          edition: 'Updated continuously',
          summary: 'Screening and prevention',
          url: 'https://example.com/ab',
        },
        {
          id: 'va-dod-hypertension',
          title: 'VA-DoD Hypertension Guideline',
          edition: '2026',
          summary: 'Adults; diagnosis, BP goals, drug choice',
          url: 'https://example.com/htn.pdf',
        },
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
  it('returns an empty page for a page number beyond what sqlite can offset', () => {
    expect(searchReferences(catalogOf21(), ['measles'], 1e20)).toEqual({
      references: [],
      total: 21,
      page: 1e20,
      pageSize: 20,
    });
  });

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
    expect(
      searchReferences(catalogDb(), ['antibiotic treatments']).references.map(
        (r) => r.id,
      ),
    ).toEqual(['cdc-pertussis-treatment']);
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

  it('treats quotes and operators in a term as plain words', () => {
    expect(
      searchReferences(catalogDb(), ['"whooping" OR']).references.map(
        (r) => r.id,
      ),
    ).toEqual(['cdc-pertussis-treatment']);
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
        reference: {
          id: 'va-dod-hypertension',
          title: 'VA-DoD Hypertension Guideline',
          edition: '2026',
          summary: 'Adults; diagnosis, BP goals, drug choice',
          url: 'https://example.com/htn.pdf',
        },
        section: null,
        sections: [
          {
            sectionId: 'ix-recommendations',
            title: 'IX. Recommendations',
            chars: 0,
            location: { kind: 'pages', start: 26, end: 26 },
            subsections: [
              {
                sectionId: 'blood-pressure-goals',
                title: 'Blood Pressure Goals',
                chars: 116,
                location: { kind: 'pages', start: 31, end: 33 },
                subsectionCount: 1,
              },
              {
                sectionId: 'drug-therapy',
                title: 'Drug Therapy',
                chars: 51,
                location: { kind: 'pages', start: 36, end: 40 },
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
        reference: {
          id: 'va-dod-hypertension',
          title: 'VA-DoD Hypertension Guideline',
          edition: '2026',
          summary: 'Adults; diagnosis, BP goals, drug choice',
          url: 'https://example.com/htn.pdf',
        },
        section: {
          sectionId: 'blood-pressure-goals',
          title: 'Blood Pressure Goals',
          chars: 116,
          location: { kind: 'pages', start: 31, end: 33 },
        },
        sections: [
          {
            sectionId: 'target-groups',
            title: 'Target Groups',
            chars: 13,
            location: { kind: 'pages', start: 34, end: 34 },
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

describe('readSection', () => {
  it('returns the section text with its reference, location, and subsections', () => {
    expect(
      readSection(seededDb(), 'va-dod-hypertension', 'blood-pressure-goals'),
    ).toEqual({
      kind: 'found',
      value: {
        reference: {
          id: 'va-dod-hypertension',
          title: 'VA-DoD Hypertension Guideline',
          edition: '2026',
          summary: 'Adults; diagnosis, BP goals, drug choice',
          url: 'https://example.com/htn.pdf',
        },
        section: {
          sectionId: 'blood-pressure-goals',
          title: 'Blood Pressure Goals',
          location: { kind: 'pages', start: 31, end: 33 },
          contentMd:
            'We recommend a systolic blood pressure goal of <130 mmHg.\n\nStanding blood pressure matters for orthostatic symptoms.',
          subsections: [
            {
              sectionId: 'target-groups',
              title: 'Target Groups',
              chars: 13,
              location: { kind: 'pages', start: 34, end: 34 },
            },
          ],
        },
      },
    });
  });

  it('carries a spoke section url in its location and in its subsection entries', () => {
    const db = openReferencesDb(':memory:');
    writeReference(db, {
      id: 'label-estradiol',
      title: 'FDA drug label: Estradiol',
      edition: '2026',
      summary: 'Estradiol; routes: oral, transdermal',
      url: 'https://dailymed.example/search?query=estradiol',
      sections: [
        {
          sectionId: 'transdermal',
          parentId: null,
          title: 'Transdermal: Minivelle',
          location: { kind: 'webpage', url: 'https://dailymed.example/patch' },
          contentMd: 'Label NDA203752 by Noven, effective 2026-07-31.',
        },
        {
          sectionId: 'transdermal-2-dosage',
          parentId: 'transdermal',
          title: '2 DOSAGE',
          location: { kind: 'webpage', url: 'https://dailymed.example/patch' },
          contentMd: 'Apply twice weekly.',
        },
      ],
    });

    expect(readSection(db, 'label-estradiol', 'transdermal')).toEqual({
      kind: 'found',
      value: {
        reference: {
          id: 'label-estradiol',
          title: 'FDA drug label: Estradiol',
          edition: '2026',
          summary: 'Estradiol; routes: oral, transdermal',
          url: 'https://dailymed.example/search?query=estradiol',
        },
        section: {
          sectionId: 'transdermal',
          title: 'Transdermal: Minivelle',
          location: { kind: 'webpage', url: 'https://dailymed.example/patch' },
          contentMd: 'Label NDA203752 by Noven, effective 2026-07-31.',
          subsections: [
            {
              sectionId: 'transdermal-2-dosage',
              title: '2 DOSAGE',
              chars: 19,
              location: {
                kind: 'webpage',
                url: 'https://dailymed.example/patch',
              },
            },
          ],
        },
      },
    });
  });

  it('gives a webpage section the webpage location', () => {
    expect(
      readSection(seededDb(), 'uspstf-a-and-b', 'screening'),
    ).toMatchObject({ value: { section: { location: { kind: 'webpage' } } } });
  });

  it('answers no-reference and no-section for unknown ids', () => {
    expect(readSection(seededDb(), 'nope', 'screening')).toEqual({
      kind: 'no-reference',
    });
    expect(readSection(seededDb(), 'uspstf-a-and-b', 'nope')).toEqual({
      kind: 'no-section',
    });
  });
});

describe('findInReference', () => {
  it('points to sections of one reference matching any term, in document order, with an excerpt of each', () => {
    expect(
      findInReference(seededDb(), 'va-dod-hypertension', [
        'orthostatic',
        'standing',
      ]),
    ).toEqual({
      kind: 'found',
      value: {
        matches: [
          {
            sectionId: 'blood-pressure-goals',
            title: 'Blood Pressure Goals',
            count: 2,
            excerpt:
              'We recommend a systolic blood pressure goal of <130 mmHg. Standing blood pressure matters for orthostatic symptoms.',
          },
          {
            sectionId: 'drug-therapy',
            title: 'Drug Therapy',
            count: 1,
            excerpt: 'Thiazides first. Watch for orthostatic hypotension.',
          },
        ],
      },
    });
  });

  it('matches a multi-word term when all its words appear, in any order, and ignores other references', () => {
    expect(
      findInReference(seededDb(), 'va-dod-hypertension', ['pressure blood']),
    ).toEqual({
      kind: 'found',
      value: {
        matches: [
          {
            sectionId: 'blood-pressure-goals',
            title: 'Blood Pressure Goals',
            count: 6,
            excerpt:
              'We recommend a systolic blood pressure goal of <130 mmHg. Standing blood pressure matters for orthostatic symptoms.',
          },
        ],
      },
    });
  });

  it('matches other forms of a word', () => {
    const result = findInReference(seededDb(), 'va-dod-hypertension', [
      'goals',
    ]);
    expect(
      result.kind === 'found' && result.value.matches.map((m) => m.sectionId),
    ).toEqual(['blood-pressure-goals']);
  });

  it('treats quotes and operators in a term as plain text', () => {
    expect(
      findInReference(seededDb(), 'va-dod-hypertension', ['"thiazides"']),
    ).toEqual({
      kind: 'found',
      value: {
        matches: [
          {
            sectionId: 'drug-therapy',
            title: 'Drug Therapy',
            count: 1,
            excerpt: 'Thiazides first. Watch for orthostatic hypotension.',
          },
        ],
      },
    });
  });

  it('finds nothing for terms with no words', () => {
    expect(
      findInReference(seededDb(), 'va-dod-hypertension', ['<', '  ']),
    ).toEqual({ kind: 'found', value: { matches: [] } });
  });

  it('answers no-reference for an unknown reference id', () => {
    expect(findInReference(seededDb(), 'nope', ['x'])).toEqual({
      kind: 'no-reference',
    });
  });
});
