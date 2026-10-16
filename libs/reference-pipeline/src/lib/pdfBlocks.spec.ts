import { ONE_PAGE_PDF } from './__fixtures__/onePagePdf';
import { pdfLinesToBlocks, readPdfLines } from './pdfBlocks';

describe('readPdfLines', () => {
  it('reads each line with its page, font size and position, joining pieces of a line at the larger size and keeping a raised superscript on its line', async () => {
    expect(await readPdfLines(new TextEncoder().encode(ONE_PAGE_PDF))).toEqual([
      { page: 1, size: 14, y: 720, text: 'I. Introduction' },
      { page: 1, size: 11, y: 700, text: 'Tdap booster every 10 years.' },
      { page: 1, size: 11, y: 680, text: 'BMI of 30 kg/m2 or more.' },
    ]);
  });
});

describe('pdfLinesToBlocks', () => {
  it('escapes markdown in paragraph text and leaves heading text plain', () => {
    expect(
      pdfLinesToBlocks([
        { page: 1, size: 14, y: 700, text: 'Use of *Tdap* [1]' },
        {
          page: 1,
          size: 11,
          y: 680,
          text: 'Give <b>one dose</b> of *Tdap* [1] by 3_months.',
        },
      ]),
    ).toEqual([
      { kind: 'heading', level: 1, text: 'Use of *Tdap* [1]', page: 1 },
      {
        kind: 'text',
        text: 'Give <b>one dose</b> of \\*Tdap\\* \\[1\\] by 3\\_months.',
        page: 1,
      },
    ]);
  });

  it('makes lines at least 2 points above the most common font size headings, larger sizes higher levels', () => {
    expect(
      pdfLinesToBlocks([
        { page: 1, size: 14, y: 700, text: 'I. Introduction' },
        { page: 1, size: 11, y: 680, text: 'This guideline covers adults.' },
        { page: 1, size: 13, y: 650, text: 'A. Scope' },
        { page: 1, size: 11, y: 630, text: 'Primary care settings only.' },
      ]),
    ).toEqual([
      { kind: 'heading', level: 1, text: 'I. Introduction', page: 1 },
      { kind: 'text', text: 'This guideline covers adults.', page: 1 },
      { kind: 'heading', level: 2, text: 'A. Scope', page: 1 },
      { kind: 'text', text: 'Primary care settings only.', page: 1 },
    ]);
  });

  it('treats a size only 1 point above the most common font size as paragraph text', () => {
    expect(
      pdfLinesToBlocks([
        { page: 1, size: 12, y: 700, text: 'Table 2. Strength' },
        {
          page: 1,
          size: 11,
          y: 600,
          text: 'Body text that dominates the page.',
        },
      ]),
    ).toEqual([
      { kind: 'text', text: 'Table 2. Strength', page: 1 },
      { kind: 'text', text: 'Body text that dominates the page.', page: 1 },
    ]);
  });

  it('joins body lines that sit close together into one paragraph', () => {
    expect(
      pdfLinesToBlocks([
        { page: 1, size: 11, y: 700, text: 'We recommend treating to a' },
        { page: 1, size: 11, y: 687, text: 'systolic goal of <130 mmHg.' },
      ]),
    ).toEqual([
      {
        kind: 'text',
        text: 'We recommend treating to a systolic goal of <130 mmHg.',
        page: 1,
      },
    ]);
  });

  it('starts a new paragraph after a wide vertical gap', () => {
    expect(
      pdfLinesToBlocks([
        { page: 1, size: 11, y: 700, text: 'First paragraph.' },
        { page: 1, size: 11, y: 660, text: 'Second paragraph.' },
      ]),
    ).toEqual([
      { kind: 'text', text: 'First paragraph.', page: 1 },
      { kind: 'text', text: 'Second paragraph.', page: 1 },
    ]);
  });

  it('starts a new paragraph when the next line sits above the previous one', () => {
    expect(
      pdfLinesToBlocks([
        { page: 1, size: 11, y: 600, text: 'End of the left column.' },
        { page: 1, size: 11, y: 650, text: 'Top of the right column.' },
      ]),
    ).toEqual([
      { kind: 'text', text: 'End of the left column.', page: 1 },
      { kind: 'text', text: 'Top of the right column.', page: 1 },
    ]);
  });

  it('starts a new paragraph on a new page', () => {
    expect(
      pdfLinesToBlocks([
        { page: 1, size: 11, y: 80, text: 'End of page one.' },
        { page: 2, size: 11, y: 720, text: 'Start of page two.' },
      ]),
    ).toEqual([
      { kind: 'text', text: 'End of page one.', page: 1 },
      { kind: 'text', text: 'Start of page two.', page: 2 },
    ]);
  });

  it('joins a heading wrapped over two lines', () => {
    expect(
      pdfLinesToBlocks([
        { page: 1, size: 14, y: 700, text: 'VII. Approach to Care and the' },
        { page: 1, size: 14, y: 684, text: 'Department of Defense' },
        {
          page: 1,
          size: 11,
          y: 660,
          text: 'Body text that outweighs the heading lines by character count.',
        },
      ]),
    ).toEqual([
      {
        kind: 'heading',
        level: 1,
        text: 'VII. Approach to Care and the Department of Defense',
        page: 1,
      },
      {
        kind: 'text',
        text: 'Body text that outweighs the heading lines by character count.',
        page: 1,
      },
    ]);
  });

  it('drops lines repeated on more than half the pages, ignoring digits', () => {
    expect(
      pdfLinesToBlocks([
        { page: 1, size: 11, y: 700, text: 'Alpha body.' },
        { page: 1, size: 9, y: 30, text: 'Page 1 of 4' },
        { page: 2, size: 11, y: 700, text: 'Beta body.' },
        { page: 2, size: 9, y: 30, text: 'Page 2 of 4' },
        { page: 3, size: 11, y: 700, text: 'Gamma body.' },
        { page: 3, size: 9, y: 30, text: 'Page 3 of 4' },
        { page: 4, size: 11, y: 700, text: 'Delta body.' },
        { page: 4, size: 9, y: 30, text: 'Page 4 of 4' },
      ]),
    ).toEqual([
      { kind: 'text', text: 'Alpha body.', page: 1 },
      { kind: 'text', text: 'Beta body.', page: 2 },
      { kind: 'text', text: 'Gamma body.', page: 3 },
      { kind: 'text', text: 'Delta body.', page: 4 },
    ]);
  });
});
