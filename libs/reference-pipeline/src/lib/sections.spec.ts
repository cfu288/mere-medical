import { blocksToDocument, splitIntoChunks } from './sections';

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
        },
        {
          sectionId: 'hypertension',
          parentId: 'screening',
          title: 'Hypertension',
          textStart: 46,
          textEnd: 69,
        },
        {
          sectionId: 'immunizations',
          parentId: null,
          title: 'Immunizations',
          textStart: 88,
          textEnd: 105,
        },
      ],
      chunks: [
        { sectionId: 'screening', chunk: 1, text: 'Screen adults.' },
        {
          sectionId: 'hypertension',
          chunk: 1,
          text: 'Measure blood pressure.',
        },
        { sectionId: 'immunizations', chunk: 1, text: 'Influenza yearly.' },
      ],
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
        },
        {
          sectionId: 'scope',
          parentId: null,
          title: 'Scope',
          textStart: 40,
          textEnd: 63,
        },
      ],
      chunks: [
        {
          sectionId: 'opening-text',
          chunk: 1,
          text: 'Published by the task force.',
        },
        { sectionId: 'scope', chunk: 1, text: 'Adults in primary care.' },
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
        },
        {
          sectionId: 'goals',
          parentId: null,
          title: 'Goals',
          textStart: 18,
          textEnd: 38,
        },
      ],
      chunks: [{ sectionId: 'goals', chunk: 1, text: 'A goal of <130 mmHg.' }],
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
        },
        {
          sectionId: 'dose-2',
          parentId: null,
          title: 'Dose',
          textStart: 24,
          textEnd: 31,
        },
        {
          sectionId: 'dose-2-2',
          parentId: null,
          title: 'Dose 2',
          textStart: 43,
          textEnd: 49,
        },
      ],
      chunks: [
        { sectionId: 'dose', chunk: 1, text: 'First.' },
        { sectionId: 'dose-2', chunk: 1, text: 'Second.' },
        { sectionId: 'dose-2-2', chunk: 1, text: 'Third.' },
      ],
    });
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
        },
      ],
      chunks: [],
    });
  });
});

describe('splitIntoChunks', () => {
  const first = 'a'.repeat(6000);
  const second = 'b'.repeat(6000);

  it('ends a chunk at the last paragraph break that fits', () => {
    expect(splitIntoChunks(first + '\n\n' + second)).toEqual([first, second]);
  });

  it('ends a chunk at the last line break when no paragraph break fits', () => {
    expect(splitIntoChunks(first + '\n' + second)).toEqual([first, second]);
  });

  it('ends a chunk at the last space when no line break fits', () => {
    expect(splitIntoChunks(first + ' ' + second)).toEqual([first, second]);
  });

  it('cuts text with no break at 10000 characters', () => {
    const full = 'c'.repeat(10000);
    const rest = 'c'.repeat(500);
    expect(splitIntoChunks(full + rest)).toEqual([full, rest]);
  });
});
