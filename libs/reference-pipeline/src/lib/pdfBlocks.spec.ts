import { BLANK_PAGE_PDF } from './__fixtures__/blankPagePdf';
import { TWO_PAGE_PDF } from './__fixtures__/twoPagePdf';
import { pdfToBlocks } from './pdfBlocks';

describe('pdfToBlocks', () => {
  it('starts each page with a heading titled with its page number, followed by its lines as pdf.js reads them', async () => {
    expect(await pdfToBlocks(new TextEncoder().encode(TWO_PAGE_PDF))).toEqual([
      { kind: 'heading', level: 1, text: 'Page 1' },
      {
        kind: 'text',
        text: 'I. Introduction\nTdap booster every 10 years.\nBMI of 30 kg/m2 or more.',
      },
      { kind: 'heading', level: 1, text: 'Page 2' },
      { kind: 'text', text: 'Repeat every 10 years.' },
    ]);
  });

  it('gives a page with no text only its heading', async () => {
    expect(await pdfToBlocks(new TextEncoder().encode(BLANK_PAGE_PDF))).toEqual(
      [{ kind: 'heading', level: 1, text: 'Page 1' }],
    );
  });
});
