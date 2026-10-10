import { SPLIT_LINE_PDF } from './__fixtures__/splitLinePdf';
import { TWO_SIZE_PDF } from './__fixtures__/twoSizePdf';
import { linesToBlocks, pdfLines } from './pdfBlocks';

describe('pdfLines', () => {
  it('reads each text line with its page, font size, and height on the page', async () => {
    expect(await pdfLines(new TextEncoder().encode(TWO_SIZE_PDF))).toEqual([
      { page: 1, size: 14, y: 720, text: 'I. Introduction' },
      { page: 1, size: 11, y: 700, text: 'Tdap booster every 10 years.' },
    ]);
  });

  it('joins text items drawn on one line into one line at the larger size', async () => {
    expect(await pdfLines(new TextEncoder().encode(SPLIT_LINE_PDF))).toEqual([
      { page: 1, size: 14, y: 720, text: 'I. Introduction' },
      { page: 1, size: 11, y: 700, text: 'Tdap booster every 10 years.' },
    ]);
  });
});

describe('linesToBlocks', () => {
  it('makes lines at least 2pt above the body size headings, larger sizes higher levels', () => {
    expect(
      linesToBlocks([
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

  it('treats a size only 1pt above the body as body text', () => {
    expect(
      linesToBlocks([
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
      linesToBlocks([
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
      linesToBlocks([
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
      linesToBlocks([
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
      linesToBlocks([
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
      linesToBlocks([
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
      linesToBlocks([
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
