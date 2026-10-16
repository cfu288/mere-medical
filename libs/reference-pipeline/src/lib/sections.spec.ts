import { groupBlocksIntoSections } from './sections';

describe('groupBlocksIntoSections', () => {
  it('nests deeper headings under the heading above them', () => {
    expect(
      groupBlocksIntoSections([
        { kind: 'heading', level: 1, text: 'Screening', page: null },
        { kind: 'text', text: 'Screen adults.', page: null },
        { kind: 'heading', level: 2, text: 'Hypertension', page: null },
        { kind: 'text', text: 'Measure blood pressure.', page: null },
        { kind: 'heading', level: 2, text: 'Diabetes', page: null },
        { kind: 'text', text: 'Check A1c.', page: null },
        { kind: 'heading', level: 1, text: 'Immunizations', page: null },
        { kind: 'text', text: 'Influenza yearly.', page: null },
      ]),
    ).toEqual([
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
    ]);
  });

  it('keeps text before the first heading as a section titled Opening text', () => {
    expect(
      groupBlocksIntoSections([
        { kind: 'text', text: 'Published by the task force.', page: null },
        { kind: 'heading', level: 2, text: 'Scope', page: null },
        { kind: 'text', text: 'Adults in primary care.', page: null },
      ]),
    ).toEqual([
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
    ]);
  });

  it('locates a pdf section by the pages of its heading and its own text', () => {
    expect(
      groupBlocksIntoSections([
        { kind: 'heading', level: 1, text: 'IX. Recommendations', page: 26 },
        { kind: 'heading', level: 2, text: 'Blood Pressure Goals', page: 31 },
        { kind: 'text', text: 'We recommend a goal of <130 mmHg.', page: 31 },
        { kind: 'text', text: 'Discussion continues.', page: 33 },
      ]),
    ).toEqual([
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
        contentMd: 'We recommend a goal of <130 mmHg.\n\nDiscussion continues.',
      },
    ]);
  });

  it('drops headings with no text of their own or in their subsections', () => {
    expect(
      groupBlocksIntoSections([
        {
          kind: 'heading',
          level: 1,
          text: 'Final Recommendation Statement',
          page: null,
        },
        { kind: 'heading', level: 1, text: 'Cover', page: null },
        { kind: 'heading', level: 2, text: 'and', page: null },
        { kind: 'heading', level: 2, text: 'Office of Quality', page: null },
        { kind: 'heading', level: 1, text: 'Recommendations', page: null },
        { kind: 'heading', level: 2, text: 'Goals', page: null },
        { kind: 'text', text: 'A goal of <130 mmHg.', page: null },
      ]),
    ).toEqual([
      {
        sectionId: 'recommendations',
        parentId: null,
        title: 'Recommendations',
        location: { kind: 'webpage' },
        contentMd: '',
      },
      {
        sectionId: 'goals',
        parentId: 'recommendations',
        title: 'Goals',
        location: { kind: 'webpage' },
        contentMd: 'A goal of <130 mmHg.',
      },
    ]);
  });

  it('gives repeated titles distinct ids', () => {
    expect(
      groupBlocksIntoSections([
        { kind: 'heading', level: 1, text: 'Background', page: null },
        { kind: 'text', text: 'First.', page: null },
        { kind: 'heading', level: 1, text: 'Background', page: null },
        { kind: 'text', text: 'Second.', page: null },
      ]),
    ).toEqual([
      {
        sectionId: 'background',
        parentId: null,
        title: 'Background',
        location: { kind: 'webpage' },
        contentMd: 'First.',
      },
      {
        sectionId: 'background-2',
        parentId: null,
        title: 'Background',
        location: { kind: 'webpage' },
        contentMd: 'Second.',
      },
    ]);
  });

  it('never gives a title the id a repeated title already took', () => {
    expect(
      groupBlocksIntoSections([
        { kind: 'heading', level: 1, text: 'Dose', page: null },
        { kind: 'text', text: 'First.', page: null },
        { kind: 'heading', level: 1, text: 'Dose', page: null },
        { kind: 'text', text: 'Second.', page: null },
        { kind: 'heading', level: 1, text: 'Dose 2', page: null },
        { kind: 'text', text: 'Third.', page: null },
      ]),
    ).toEqual([
      {
        sectionId: 'dose',
        parentId: null,
        title: 'Dose',
        location: { kind: 'webpage' },
        contentMd: 'First.',
      },
      {
        sectionId: 'dose-2',
        parentId: null,
        title: 'Dose',
        location: { kind: 'webpage' },
        contentMd: 'Second.',
      },
      {
        sectionId: 'dose-2-2',
        parentId: null,
        title: 'Dose 2',
        location: { kind: 'webpage' },
        contentMd: 'Third.',
      },
    ]);
  });

  it('keeps reference lists and appendices as sections', () => {
    expect(
      groupBlocksIntoSections([
        { kind: 'heading', level: 1, text: 'Recommendations', page: null },
        { kind: 'text', text: 'We recommend a goal of <130 mmHg.', page: null },
        {
          kind: 'heading',
          level: 1,
          text: 'Appendix D: Participant List',
          page: null,
        },
        { kind: 'text', text: 'Jane Doe, MD', page: null },
        { kind: 'heading', level: 1, text: 'References', page: null },
        { kind: 'text', text: '1. Smith J. Trial. 2020.', page: null },
      ]),
    ).toEqual([
      {
        sectionId: 'recommendations',
        parentId: null,
        title: 'Recommendations',
        location: { kind: 'webpage' },
        contentMd: 'We recommend a goal of <130 mmHg.',
      },
      {
        sectionId: 'appendix-d-participant-list',
        parentId: null,
        title: 'Appendix D: Participant List',
        location: { kind: 'webpage' },
        contentMd: 'Jane Doe, MD',
      },
      {
        sectionId: 'references',
        parentId: null,
        title: 'References',
        location: { kind: 'webpage' },
        contentMd: '1. Smith J. Trial. 2020.',
      },
    ]);
  });

  it('splits a pdf section longer than 12000 characters into one subsection per page', () => {
    const pageTwo = 'a'.repeat(7000);
    const pageThree = 'b'.repeat(7000);
    expect(
      groupBlocksIntoSections([
        { kind: 'heading', level: 1, text: 'Adult Schedule', page: 2 },
        { kind: 'text', text: pageTwo, page: 2 },
        { kind: 'text', text: pageThree, page: 3 },
      ]),
    ).toEqual([
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
    ]);
  });
});
