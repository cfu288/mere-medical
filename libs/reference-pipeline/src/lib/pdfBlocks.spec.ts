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
  it('starts each page with a heading titled with its page number and keeps every line as text, as written', () => {
    expect(
      pdfLinesToBlocks([
        { page: 1, size: 14, y: 700, text: 'Use of *Tdap* [1]' },
        {
          page: 1,
          size: 11,
          y: 680,
          text: 'Give <b>one dose</b> by 3_months.',
        },
        { page: 2, size: 11, y: 700, text: 'Repeat every 10 years.' },
      ]),
    ).toEqual([
      { kind: 'heading', level: 1, text: 'Page 1', page: 1 },
      { kind: 'text', text: 'Use of *Tdap* [1]', page: 1 },
      { kind: 'text', text: 'Give <b>one dose</b> by 3_months.', page: 1 },
      { kind: 'heading', level: 1, text: 'Page 2', page: 2 },
      { kind: 'text', text: 'Repeat every 10 years.', page: 2 },
    ]);
  });

  it('joins lines that sit close together at one size into one paragraph', () => {
    expect(
      pdfLinesToBlocks([
        { page: 1, size: 10, y: 700, text: 'We recommend a goal' },
        { page: 1, size: 10, y: 688, text: 'below 130 mmHg.' },
      ]),
    ).toEqual([
      { kind: 'heading', level: 1, text: 'Page 1', page: 1 },
      { kind: 'text', text: 'We recommend a goal below 130 mmHg.', page: 1 },
    ]);
  });

  it('starts a new paragraph after a gap of more than 1.8 times the font size', () => {
    expect(
      pdfLinesToBlocks([
        { page: 1, size: 10, y: 700, text: 'First paragraph.' },
        { page: 1, size: 10, y: 681, text: 'Second paragraph.' },
      ]),
    ).toEqual([
      { kind: 'heading', level: 1, text: 'Page 1', page: 1 },
      { kind: 'text', text: 'First paragraph.', page: 1 },
      { kind: 'text', text: 'Second paragraph.', page: 1 },
    ]);
  });

  it('starts a new paragraph when the next line sits above the previous one', () => {
    expect(
      pdfLinesToBlocks([
        { page: 1, size: 10, y: 100, text: 'End of left column.' },
        { page: 1, size: 10, y: 700, text: 'Top of right column.' },
      ]),
    ).toEqual([
      { kind: 'heading', level: 1, text: 'Page 1', page: 1 },
      { kind: 'text', text: 'End of left column.', page: 1 },
      { kind: 'text', text: 'Top of right column.', page: 1 },
    ]);
  });

  it('starts a new paragraph at a new font size', () => {
    expect(
      pdfLinesToBlocks([
        { page: 1, size: 14, y: 700, text: 'Recommendations' },
        { page: 1, size: 10, y: 688, text: 'We recommend a goal.' },
      ]),
    ).toEqual([
      { kind: 'heading', level: 1, text: 'Page 1', page: 1 },
      { kind: 'text', text: 'Recommendations', page: 1 },
      { kind: 'text', text: 'We recommend a goal.', page: 1 },
    ]);
  });

  it('drops lines repeated on more than half the pages, ignoring the digits in lines with words', () => {
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
      { kind: 'heading', level: 1, text: 'Page 1', page: 1 },
      { kind: 'text', text: 'Alpha body.', page: 1 },
      { kind: 'heading', level: 1, text: 'Page 2', page: 2 },
      { kind: 'text', text: 'Beta body.', page: 2 },
      { kind: 'heading', level: 1, text: 'Page 3', page: 3 },
      { kind: 'text', text: 'Gamma body.', page: 3 },
      { kind: 'heading', level: 1, text: 'Page 4', page: 4 },
      { kind: 'text', text: 'Delta body.', page: 4 },
    ]);
  });

  it('keeps lines of bare numbers that differ from page to page', () => {
    expect(
      pdfLinesToBlocks([
        { page: 1, size: 11, y: 700, text: '10' },
        { page: 2, size: 11, y: 700, text: '25' },
        { page: 3, size: 11, y: 700, text: '5' },
        { page: 4, size: 11, y: 700, text: '40' },
      ]),
    ).toEqual([
      { kind: 'heading', level: 1, text: 'Page 1', page: 1 },
      { kind: 'text', text: '10', page: 1 },
      { kind: 'heading', level: 1, text: 'Page 2', page: 2 },
      { kind: 'text', text: '25', page: 2 },
      { kind: 'heading', level: 1, text: 'Page 3', page: 3 },
      { kind: 'text', text: '5', page: 3 },
      { kind: 'heading', level: 1, text: 'Page 4', page: 4 },
      { kind: 'text', text: '40', page: 4 },
    ]);
  });

  it('drops bare page numbers that rise with the page, even when they start after the first page', () => {
    expect(
      pdfLinesToBlocks([
        { page: 1, size: 11, y: 700, text: 'Alpha body.' },
        { page: 1, size: 9, y: 30, text: '3' },
        { page: 2, size: 11, y: 700, text: 'Beta body.' },
        { page: 2, size: 9, y: 30, text: '4' },
        { page: 3, size: 11, y: 700, text: 'Gamma body.' },
        { page: 3, size: 9, y: 30, text: '5' },
        { page: 4, size: 11, y: 700, text: 'Delta body.' },
        { page: 4, size: 9, y: 30, text: '6' },
      ]),
    ).toEqual([
      { kind: 'heading', level: 1, text: 'Page 1', page: 1 },
      { kind: 'text', text: 'Alpha body.', page: 1 },
      { kind: 'heading', level: 1, text: 'Page 2', page: 2 },
      { kind: 'text', text: 'Beta body.', page: 2 },
      { kind: 'heading', level: 1, text: 'Page 3', page: 3 },
      { kind: 'text', text: 'Gamma body.', page: 3 },
      { kind: 'heading', level: 1, text: 'Page 4', page: 4 },
      { kind: 'text', text: 'Delta body.', page: 4 },
    ]);
  });
});
