import { buildSections, buildSpokeSections } from './sections';

describe('buildSections', () => {
  it('nests deeper headings under the heading above them', () => {
    expect(
      buildSections({
        kind: 'webpage',
        blocks: [
          { kind: 'heading', level: 1, text: 'Screening' },
          { kind: 'text', text: 'Screen adults.' },
          { kind: 'heading', level: 2, text: 'Hypertension' },
          { kind: 'text', text: 'Measure blood pressure.' },
          { kind: 'heading', level: 2, text: 'Diabetes' },
          { kind: 'text', text: 'Check A1c.' },
          { kind: 'heading', level: 1, text: 'Immunizations' },
          { kind: 'text', text: 'Influenza yearly.' },
        ],
      }),
    ).toEqual({
      sections: [
        {
          sectionId: 'screening',
          parentId: null,
          title: 'Screening',
          location: { kind: 'webpage' },
          contentMd: 'Screen adults.',
        },
        {
          sectionId: 'hypertension',
          parentId: 'screening',
          title: 'Hypertension',
          location: { kind: 'webpage' },
          contentMd: 'Measure blood pressure.',
        },
        {
          sectionId: 'diabetes',
          parentId: 'screening',
          title: 'Diabetes',
          location: { kind: 'webpage' },
          contentMd: 'Check A1c.',
        },
        {
          sectionId: 'immunizations',
          parentId: null,
          title: 'Immunizations',
          location: { kind: 'webpage' },
          contentMd: 'Influenza yearly.',
        },
      ],
      dropped: [],
    });
  });

  it('keeps text before the first heading as an opening section', () => {
    expect(
      buildSections({
        kind: 'webpage',
        blocks: [
          { kind: 'text', text: 'Published by the task force.' },
          { kind: 'heading', level: 2, text: 'Scope' },
          { kind: 'text', text: 'Adults in primary care.' },
        ],
      }),
    ).toEqual({
      sections: [
        {
          sectionId: 'opening-text',
          parentId: null,
          title: 'Opening text',
          location: { kind: 'webpage' },
          contentMd: 'Published by the task force.',
        },
        {
          sectionId: 'scope',
          parentId: null,
          title: 'Scope',
          location: { kind: 'webpage' },
          contentMd: 'Adults in primary care.',
        },
      ],
      dropped: [],
    });
  });

  it('locates a pdf section by the pages of its heading and its own text', () => {
    expect(
      buildSections({
        kind: 'paged',
        blocks: [
          { kind: 'heading', level: 1, text: 'IX. Recommendations', page: 26 },
          { kind: 'heading', level: 2, text: 'Blood Pressure Goals', page: 31 },
          { kind: 'text', text: 'We recommend a goal of <130 mmHg.', page: 31 },
          { kind: 'text', text: 'Discussion continues.', page: 33 },
        ],
      }),
    ).toEqual({
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
            'We recommend a goal of <130 mmHg.\n\nDiscussion continues.',
        },
      ],
      dropped: [],
    });
  });

  it('drops headings with no text of their own or in their subsections', () => {
    expect(
      buildSections({
        kind: 'webpage',
        blocks: [
          { kind: 'heading', level: 1, text: 'Final Recommendation Statement' },
          { kind: 'heading', level: 1, text: 'Cover' },
          { kind: 'heading', level: 2, text: 'and' },
          { kind: 'heading', level: 2, text: 'Office of Quality' },
          { kind: 'heading', level: 1, text: 'Recommendations' },
          { kind: 'heading', level: 2, text: 'Goals' },
          { kind: 'text', text: 'A goal of <130 mmHg.' },
        ],
      }).sections.map((s) => s.sectionId),
    ).toEqual(['recommendations', 'goals']);
  });

  it('gives repeated titles distinct ids', () => {
    expect(
      buildSections({
        kind: 'webpage',
        blocks: [
          { kind: 'heading', level: 1, text: 'Background' },
          { kind: 'text', text: 'First.' },
          { kind: 'heading', level: 1, text: 'Background' },
          { kind: 'text', text: 'Second.' },
        ],
      }).sections.map((s) => s.sectionId),
    ).toEqual(['background', 'background-2']);
  });

  it('drops reference lists, participant lists, abbreviations, search strategy, and categorization appendices with their subsections', () => {
    expect(
      buildSections({
        kind: 'webpage',
        blocks: [
          { kind: 'heading', level: 1, text: 'Recommendations' },
          { kind: 'text', text: 'We recommend a goal of <130 mmHg.' },
          {
            kind: 'heading',
            level: 1,
            text: 'Appendix C: 2020 Recommendation Categorization',
          },
          { kind: 'heading', level: 2, text: 'Carried Forward' },
          { kind: 'text', text: 'We suggest a goal of <130 mmHg.' },
          { kind: 'heading', level: 1, text: 'Appendix D: Participant List' },
          {
            kind: 'heading',
            level: 1,
            text: 'Appendix F. Literature Review Search Terms and Strategy',
          },
          { kind: 'heading', level: 1, text: 'Appendix L. Abbreviation List' },
          { kind: 'heading', level: 1, text: 'References' },
          { kind: 'text', text: '1. Smith J. Trial. 2020.' },
        ],
      }),
    ).toEqual({
      sections: [
        {
          sectionId: 'recommendations',
          parentId: null,
          title: 'Recommendations',
          location: { kind: 'webpage' },
          contentMd: 'We recommend a goal of <130 mmHg.',
        },
      ],
      dropped: [
        'Appendix C: 2020 Recommendation Categorization',
        'Appendix D: Participant List',
        'Appendix F. Literature Review Search Terms and Strategy',
        'Appendix L. Abbreviation List',
        'References',
      ],
    });
  });

  it('keeps a section whose title only mentions references', () => {
    expect(
      buildSections({
        kind: 'webpage',
        blocks: [
          { kind: 'heading', level: 1, text: 'Patient References and Values' },
        ],
      }).dropped,
    ).toEqual([]);
  });

  it('splits a pdf section longer than 12000 characters into one subsection per page', () => {
    const pageTwo = 'a'.repeat(7000);
    const pageThree = 'b'.repeat(7000);
    expect(
      buildSections({
        kind: 'paged',
        blocks: [
          { kind: 'heading', level: 1, text: 'Adult Schedule', page: 2 },
          { kind: 'text', text: pageTwo, page: 2 },
          { kind: 'text', text: pageThree, page: 3 },
        ],
      }),
    ).toEqual({
      sections: [
        {
          sectionId: 'adult-schedule',
          parentId: null,
          title: 'Adult Schedule',
          location: { kind: 'pages', start: 2, end: 2 },
          contentMd: '',
        },
        {
          sectionId: 'page-2',
          parentId: 'adult-schedule',
          title: 'Page 2',
          location: { kind: 'pages', start: 2, end: 2 },
          contentMd: pageTwo,
        },
        {
          sectionId: 'page-3',
          parentId: 'adult-schedule',
          title: 'Page 3',
          location: { kind: 'pages', start: 3, end: 3 },
          contentMd: pageThree,
        },
      ],
      dropped: [],
    });
  });
});

describe('buildSpokeSections', () => {
  it('nests each spoke document under its own section, prefixing ids and citing the spoke url', () => {
    expect(
      buildSpokeSections([
        {
          id: 'oral',
          title: 'Oral: Zestril',
          url: 'https://dailymed.example/oral',
          contentMd: 'Label NDA019777 by Merck, effective 2025-01-15.',
          document: {
            kind: 'webpage',
            blocks: [
              { kind: 'heading', level: 1, text: '2 DOSAGE' },
              { kind: 'text', text: 'One tablet daily.' },
            ],
          },
        },
        {
          id: 'transdermal',
          title: 'Transdermal: Minivelle',
          url: 'https://dailymed.example/patch',
          contentMd: 'Label NDA203752 by Noven, effective 2026-07-31.',
          document: {
            kind: 'webpage',
            blocks: [
              { kind: 'heading', level: 1, text: '2 DOSAGE' },
              { kind: 'text', text: 'Apply twice weekly.' },
            ],
          },
        },
      ]),
    ).toEqual({
      sections: [
        {
          sectionId: 'oral',
          parentId: null,
          title: 'Oral: Zestril',
          location: { kind: 'webpage', url: 'https://dailymed.example/oral' },
          contentMd: 'Label NDA019777 by Merck, effective 2025-01-15.',
        },
        {
          sectionId: 'oral-2-dosage',
          parentId: 'oral',
          title: '2 DOSAGE',
          location: { kind: 'webpage', url: 'https://dailymed.example/oral' },
          contentMd: 'One tablet daily.',
        },
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
      dropped: [],
    });
  });
});
