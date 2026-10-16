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
        },
        {
          sectionId: 'hypertension',
          parentId: 'screening',
          title: 'Hypertension',
          pdfPages: null,
          textStart: 46,
          textEnd: 69,
        },
        {
          sectionId: 'immunizations',
          parentId: null,
          title: 'Immunizations',
          pdfPages: null,
          textStart: 88,
          textEnd: 105,
        },
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
        },
        {
          sectionId: 'children',
          parentId: 'dosing',
          title: 'Children',
          pdfPages: null,
          textStart: 30,
          textEnd: 30,
        },
      ],
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
        },
        {
          sectionId: 'scope',
          parentId: null,
          title: 'Scope',
          pdfPages: null,
          textStart: 40,
          textEnd: 63,
        },
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
        },
        {
          sectionId: 'blood-pressure-goals',
          parentId: 'ix-recommendations',
          title: 'Blood Pressure Goals',
          pdfPages: { start: 31, end: 33 },
          textStart: 84,
          textEnd: 158,
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
        },
        {
          sectionId: 'goals',
          parentId: null,
          title: 'Goals',
          pdfPages: null,
          textStart: 18,
          textEnd: 38,
        },
      ],
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
        },
        {
          sectionId: 'dose-2',
          parentId: null,
          title: 'Dose',
          pdfPages: null,
          textStart: 24,
          textEnd: 31,
        },
        {
          sectionId: 'dose-2-2',
          parentId: null,
          title: 'Dose 2',
          pdfPages: null,
          textStart: 43,
          textEnd: 49,
        },
      ],
    });
  });
});
