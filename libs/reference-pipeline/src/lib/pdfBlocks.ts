import { Block } from './sections';

/**
 * Turns the PDF of a `pdf` source into blocks for `blocksToDocument`.
 *
 * Each page becomes a "Page N" heading followed by the page's lines. This
 * makes each page one section, and a citation can name its page. Not every
 * PDF marks its headings, but every PDF has pages.
 *
 * @param bytes `Uint8Array`. The PDF file.
 * @returns `Promise<Block[]>`. The blocks in reading order.
 *
 * @example
 * await pdfToBlocks(readFileSync('guideline.pdf'));
 * // [
 * //   { kind: 'heading', level: 1, text: 'Page 1' },
 * //   { kind: 'text', text: 'I. Introduction\nTdap booster every 10 years.' },
 * // ]
 */
export async function pdfToBlocks(bytes: Uint8Array): Promise<Block[]> {
  // pdf.js asks for its legacy build in Node.
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const pdfLoadingTask = pdfjs.getDocument({ data: bytes, verbosity: 0 });
  try {
    const doc = await pdfLoadingTask.promise;
    const blocks: Block[] = [];
    for (let page = 1; page <= doc.numPages; page++) {
      const content = await (await doc.getPage(page)).getTextContent();
      let pageText = '';
      for (const item of content.items) {
        if ('str' in item) {
          pageText += item.str + (item.hasEOL ? '\n' : '');
        }
      }
      const lines = pageText
        .split('\n')
        .map((line) => line.replace(/\s+/g, ' ').trim())
        .filter((line) => line !== '');
      blocks.push({ kind: 'heading', level: 1, text: `Page ${page}` });
      if (lines.length > 0) {
        blocks.push({ kind: 'text', text: lines.join('\n') });
      }
    }
    return blocks;
  } finally {
    await pdfLoadingTask.destroy();
  }
}
