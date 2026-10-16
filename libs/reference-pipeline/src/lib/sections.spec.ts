import { blocksToDocument } from './sections';

describe('blocksToDocument', () => {
  it('writes one markdown document and nests deeper headings under the heading above them', () => {
    expect(
      blocksToDocument([
        { kind: 'heading', level: 1, text: 'Screening' },
        { kind: 'text', text: 'Screen adults.' },
        { kind: 'heading', level: 2, text: 'Hypertension' },
        { kind: 'text', text: 'Measure blood pressure.' },
        { kind: 'heading', level: 1, text: 'Immunizations' },
        { kind: 'text', text: 'Influenza yearly.' },
      ]),
    ).toEqual({
      markdown:
        '# Screening\n\nScreen adults.\n\n## Hypertension\n\nMeasure blood pressure.\n\n# Immunizations\n\nInfluenza yearly.',
      sections: [
        {
          sectionId: 'screening',
          parentId: null,
          title: 'Screening',
          textStart: 13,
          textEnd: 27,
          partCount: 1,
        },
        {
          sectionId: 'hypertension',
          parentId: 'screening',
          title: 'Hypertension',
          textStart: 46,
          textEnd: 69,
          partCount: 1,
        },
        {
          sectionId: 'immunizations',
          parentId: null,
          title: 'Immunizations',
          textStart: 88,
          textEnd: 105,
          partCount: 1,
        },
      ],
      parts: [
        { sectionId: 'screening', part: 1, text: 'Screen adults.' },
        { sectionId: 'hypertension', part: 1, text: 'Measure blood pressure.' },
        { sectionId: 'immunizations', part: 1, text: 'Influenza yearly.' },
      ],
    });
  });

  it('prints a heading deeper than level 6 with six hash signs and keeps it nested', () => {
    expect(
      blocksToDocument([
        { kind: 'heading', level: 6, text: 'Dosing' },
        { kind: 'heading', level: 7, text: 'Children' },
      ]),
    ).toEqual({
      markdown: '###### Dosing\n\n###### Children',
      sections: [
        {
          sectionId: 'dosing',
          parentId: null,
          title: 'Dosing',
          textStart: 13,
          textEnd: 13,
          partCount: 0,
        },
        {
          sectionId: 'children',
          parentId: 'dosing',
          title: 'Children',
          textStart: 30,
          textEnd: 30,
          partCount: 0,
        },
      ],
      parts: [],
    });
  });

  it('keeps text before the first heading as a section titled Opening text', () => {
    expect(
      blocksToDocument([
        { kind: 'text', text: 'Published by the task force.' },
        { kind: 'heading', level: 2, text: 'Scope' },
        { kind: 'text', text: 'Adults in primary care.' },
      ]),
    ).toEqual({
      markdown:
        'Published by the task force.\n\n## Scope\n\nAdults in primary care.',
      sections: [
        {
          sectionId: 'opening-text',
          parentId: null,
          title: 'Opening text',
          textStart: 0,
          textEnd: 28,
          partCount: 1,
        },
        {
          sectionId: 'scope',
          parentId: null,
          title: 'Scope',
          textStart: 40,
          textEnd: 63,
          partCount: 1,
        },
      ],
      parts: [
        {
          sectionId: 'opening-text',
          part: 1,
          text: 'Published by the task force.',
        },
        { sectionId: 'scope', part: 1, text: 'Adults in primary care.' },
      ],
    });
  });

  it('keeps a heading with no text as a section whose text is empty', () => {
    expect(
      blocksToDocument([
        { kind: 'heading', level: 1, text: 'Cover' },
        { kind: 'heading', level: 1, text: 'Goals' },
        { kind: 'text', text: 'A goal of <130 mmHg.' },
      ]),
    ).toEqual({
      markdown: '# Cover\n\n# Goals\n\nA goal of <130 mmHg.',
      sections: [
        {
          sectionId: 'cover',
          parentId: null,
          title: 'Cover',
          textStart: 7,
          textEnd: 7,
          partCount: 0,
        },
        {
          sectionId: 'goals',
          parentId: null,
          title: 'Goals',
          textStart: 18,
          textEnd: 38,
          partCount: 1,
        },
      ],
      parts: [{ sectionId: 'goals', part: 1, text: 'A goal of <130 mmHg.' }],
    });
  });

  it('gives repeated titles distinct ids, never reusing an id a repeat already took', () => {
    expect(
      blocksToDocument([
        { kind: 'heading', level: 1, text: 'Dose' },
        { kind: 'text', text: 'First.' },
        { kind: 'heading', level: 1, text: 'Dose' },
        { kind: 'text', text: 'Second.' },
        { kind: 'heading', level: 1, text: 'Dose 2' },
        { kind: 'text', text: 'Third.' },
      ]),
    ).toEqual({
      markdown: '# Dose\n\nFirst.\n\n# Dose\n\nSecond.\n\n# Dose 2\n\nThird.',
      sections: [
        {
          sectionId: 'dose',
          parentId: null,
          title: 'Dose',
          textStart: 8,
          textEnd: 14,
          partCount: 1,
        },
        {
          sectionId: 'dose-2',
          parentId: null,
          title: 'Dose',
          textStart: 24,
          textEnd: 31,
          partCount: 1,
        },
        {
          sectionId: 'dose-2-2',
          parentId: null,
          title: 'Dose 2',
          textStart: 43,
          textEnd: 49,
          partCount: 1,
        },
      ],
      parts: [
        { sectionId: 'dose', part: 1, text: 'First.' },
        { sectionId: 'dose-2', part: 1, text: 'Second.' },
        { sectionId: 'dose-2-2', part: 1, text: 'Third.' },
      ],
    });
  });

  it('splits a long section into parts of at most 10000 characters at paragraph breaks', () => {
    const first = 'a'.repeat(6000);
    const second = 'b'.repeat(6000);
    expect(
      blocksToDocument([
        { kind: 'heading', level: 1, text: 'Doses' },
        { kind: 'text', text: first },
        { kind: 'text', text: second },
      ]).parts,
    ).toEqual([
      { sectionId: 'doses', part: 1, text: first },
      { sectionId: 'doses', part: 2, text: second },
    ]);
  });

  it('cuts a paragraph longer than a part at 10000 characters', () => {
    const page = 'c'.repeat(10000);
    const rest = 'c'.repeat(500);
    expect(
      blocksToDocument([
        { kind: 'heading', level: 1, text: 'Table' },
        { kind: 'text', text: page + rest },
      ]).parts,
    ).toEqual([
      { sectionId: 'table', part: 1, text: page },
      { sectionId: 'table', part: 2, text: rest },
    ]);
  });

  it('cuts a section id made from a long title to 60 characters', () => {
    expect(
      blocksToDocument([
        {
          kind: 'heading',
          level: 1,
          text: 'B. Treatment Goals and General Approaches to Hypertension Management',
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
          textStart: 70,
          textEnd: 70,
          partCount: 0,
        },
      ],
      parts: [],
    });
  });
});
