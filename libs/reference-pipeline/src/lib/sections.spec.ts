import { blocksToDocument } from './sections';

describe('blocksToDocument', () => {
  it('writes one markdown document and nests deeper headings under the heading above them', () => {
    expect(
      blocksToDocument([
        { kind: 'heading', level: 1, text: 'Screening', page: null },
        { kind: 'text', text: 'Screen adults.', page: null },
        { kind: 'heading', level: 2, text: 'Hypertension', page: null },
        { kind: 'text', text: 'Measure blood pressure.', page: null },
        { kind: 'heading', level: 1, text: 'Immunizations', page: null },
        { kind: 'text', text: 'Influenza yearly.', page: null },
      ]),
    ).toEqual({
      markdown:
        '# Screening\n\nScreen adults.\n\n## Hypertension\n\nMeasure blood pressure.\n\n# Immunizations\n\nInfluenza yearly.',
      sections: [
        {
          sectionId: 'screening',
          parentId: null,
          title: 'Screening',
          pdfPages: null,
          textStart: 13,
          textEnd: 27,
          pageCount: 1,
        },
        {
          sectionId: 'hypertension',
          parentId: 'screening',
          title: 'Hypertension',
          pdfPages: null,
          textStart: 46,
          textEnd: 69,
          pageCount: 1,
        },
        {
          sectionId: 'immunizations',
          parentId: null,
          title: 'Immunizations',
          pdfPages: null,
          textStart: 88,
          textEnd: 105,
          pageCount: 1,
        },
      ],
      pages: [
        { sectionId: 'screening', page: 1, text: 'Screen adults.' },
        { sectionId: 'hypertension', page: 1, text: 'Measure blood pressure.' },
        { sectionId: 'immunizations', page: 1, text: 'Influenza yearly.' },
      ],
    });
  });

  it('prints a heading deeper than level 6 with six hash signs and keeps it nested', () => {
    expect(
      blocksToDocument([
        { kind: 'heading', level: 6, text: 'Dosing', page: null },
        { kind: 'heading', level: 7, text: 'Children', page: null },
      ]),
    ).toEqual({
      markdown: '###### Dosing\n\n###### Children',
      sections: [
        {
          sectionId: 'dosing',
          parentId: null,
          title: 'Dosing',
          pdfPages: null,
          textStart: 13,
          textEnd: 13,
          pageCount: 0,
        },
        {
          sectionId: 'children',
          parentId: 'dosing',
          title: 'Children',
          pdfPages: null,
          textStart: 30,
          textEnd: 30,
          pageCount: 0,
        },
      ],
      pages: [],
    });
  });

  it('keeps text before the first heading as a section titled Opening text', () => {
    expect(
      blocksToDocument([
        { kind: 'text', text: 'Published by the task force.', page: null },
        { kind: 'heading', level: 2, text: 'Scope', page: null },
        { kind: 'text', text: 'Adults in primary care.', page: null },
      ]),
    ).toEqual({
      markdown:
        'Published by the task force.\n\n## Scope\n\nAdults in primary care.',
      sections: [
        {
          sectionId: 'opening-text',
          parentId: null,
          title: 'Opening text',
          pdfPages: null,
          textStart: 0,
          textEnd: 28,
          pageCount: 1,
        },
        {
          sectionId: 'scope',
          parentId: null,
          title: 'Scope',
          pdfPages: null,
          textStart: 40,
          textEnd: 63,
          pageCount: 1,
        },
      ],
      pages: [
        {
          sectionId: 'opening-text',
          page: 1,
          text: 'Published by the task force.',
        },
        { sectionId: 'scope', page: 1, text: 'Adults in primary care.' },
      ],
    });
  });

  it('marks each new pdf page in the markdown and locates a section by its pages', () => {
    expect(
      blocksToDocument([
        { kind: 'heading', level: 1, text: 'IX. Recommendations', page: 26 },
        { kind: 'heading', level: 2, text: 'Blood Pressure Goals', page: 31 },
        { kind: 'text', text: 'We recommend a goal of <130 mmHg.', page: 31 },
        { kind: 'text', text: 'Discussion continues.', page: 33 },
      ]),
    ).toEqual({
      markdown:
        '<!-- page 26 -->\n\n# IX. Recommendations\n\n<!-- page 31 -->\n\n## Blood Pressure Goals\n\nWe recommend a goal of <130 mmHg.\n\n<!-- page 33 -->\n\nDiscussion continues.',
      sections: [
        {
          sectionId: 'ix-recommendations',
          parentId: null,
          title: 'IX. Recommendations',
          pdfPages: { start: 26, end: 26 },
          textStart: 39,
          textEnd: 39,
          pageCount: 0,
        },
        {
          sectionId: 'blood-pressure-goals',
          parentId: 'ix-recommendations',
          title: 'Blood Pressure Goals',
          pdfPages: { start: 31, end: 33 },
          textStart: 84,
          textEnd: 158,
          pageCount: 1,
        },
      ],
      pages: [
        {
          sectionId: 'blood-pressure-goals',
          page: 1,
          text: 'We recommend a goal of <130 mmHg.\n\n<!-- page 33 -->\n\nDiscussion continues.',
        },
      ],
    });
  });

  it('keeps a heading with no text as a section whose text is empty', () => {
    expect(
      blocksToDocument([
        { kind: 'heading', level: 1, text: 'Cover', page: null },
        { kind: 'heading', level: 1, text: 'Goals', page: null },
        { kind: 'text', text: 'A goal of <130 mmHg.', page: null },
      ]),
    ).toEqual({
      markdown: '# Cover\n\n# Goals\n\nA goal of <130 mmHg.',
      sections: [
        {
          sectionId: 'cover',
          parentId: null,
          title: 'Cover',
          pdfPages: null,
          textStart: 7,
          textEnd: 7,
          pageCount: 0,
        },
        {
          sectionId: 'goals',
          parentId: null,
          title: 'Goals',
          pdfPages: null,
          textStart: 18,
          textEnd: 38,
          pageCount: 1,
        },
      ],
      pages: [{ sectionId: 'goals', page: 1, text: 'A goal of <130 mmHg.' }],
    });
  });

  it('gives repeated titles distinct ids, never reusing an id a repeat already took', () => {
    expect(
      blocksToDocument([
        { kind: 'heading', level: 1, text: 'Dose', page: null },
        { kind: 'text', text: 'First.', page: null },
        { kind: 'heading', level: 1, text: 'Dose', page: null },
        { kind: 'text', text: 'Second.', page: null },
        { kind: 'heading', level: 1, text: 'Dose 2', page: null },
        { kind: 'text', text: 'Third.', page: null },
      ]),
    ).toEqual({
      markdown: '# Dose\n\nFirst.\n\n# Dose\n\nSecond.\n\n# Dose 2\n\nThird.',
      sections: [
        {
          sectionId: 'dose',
          parentId: null,
          title: 'Dose',
          pdfPages: null,
          textStart: 8,
          textEnd: 14,
          pageCount: 1,
        },
        {
          sectionId: 'dose-2',
          parentId: null,
          title: 'Dose',
          pdfPages: null,
          textStart: 24,
          textEnd: 31,
          pageCount: 1,
        },
        {
          sectionId: 'dose-2-2',
          parentId: null,
          title: 'Dose 2',
          pdfPages: null,
          textStart: 43,
          textEnd: 49,
          pageCount: 1,
        },
      ],
      pages: [
        { sectionId: 'dose', page: 1, text: 'First.' },
        { sectionId: 'dose-2', page: 1, text: 'Second.' },
        { sectionId: 'dose-2-2', page: 1, text: 'Third.' },
      ],
    });
  });

  it('splits a long section into pages of at most 10000 characters at paragraph breaks', () => {
    const first = 'a'.repeat(6000);
    const second = 'b'.repeat(6000);
    expect(
      blocksToDocument([
        { kind: 'heading', level: 1, text: 'Doses', page: null },
        { kind: 'text', text: first, page: null },
        { kind: 'text', text: second, page: null },
      ]).pages,
    ).toEqual([
      { sectionId: 'doses', page: 1, text: first },
      { sectionId: 'doses', page: 2, text: second },
    ]);
  });

  it('cuts a paragraph longer than a page at 10000 characters', () => {
    const page = 'c'.repeat(10000);
    const rest = 'c'.repeat(500);
    expect(
      blocksToDocument([
        { kind: 'heading', level: 1, text: 'Table', page: null },
        { kind: 'text', text: page + rest, page: null },
      ]).pages,
    ).toEqual([
      { sectionId: 'table', page: 1, text: page },
      { sectionId: 'table', page: 2, text: rest },
    ]);
  });

  it('cuts a section id made from a long title to 60 characters', () => {
    expect(
      blocksToDocument([
        {
          kind: 'heading',
          level: 1,
          text: 'B. Treatment Goals and General Approaches to Hypertension Management',
          page: null,
        },
      ]),
    ).toEqual({
      markdown:
        '# B. Treatment Goals and General Approaches to Hypertension Management',
      sections: [
        {
          sectionId:
            'b-treatment-goals-and-general-approaches-to-hypertension-man',
          parentId: null,
          title:
            'B. Treatment Goals and General Approaches to Hypertension Management',
          pdfPages: null,
          textStart: 70,
          textEnd: 70,
          pageCount: 0,
        },
      ],
      pages: [],
    });
  });
});
