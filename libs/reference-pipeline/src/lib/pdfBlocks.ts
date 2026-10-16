import { Block } from './sections';

/**
 * Reads a PDF with pdf.js and turns it into blocks, one section per page.
 *
 * - Each page starts with a heading titled "Page N". Most PDFs have no heading
 *   markup.
 * - The page's text follows as one block, one line per line that pdf.js
 *   reports. A raised superscript stays on its line.
 * - It collapses the spaces in each line and skips empty lines. A page with no
 *   text gets only its heading.
 *
 * @param bytes `Uint8Array`. The PDF file.
 * @returns `Promise<Block[]>`. The blocks in reading order, each with its page.
 *
 * @example
 * await pdfToBlocks(readFileSync('guideline.pdf'));
 * // [
 * //   { kind: 'heading', level: 1, text: 'Page 1', page: 1 },
 * //   { kind: 'text', text: 'I. Introduction\nTdap booster every 10 years.', page: 1 },
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
      blocks.push({ kind: 'heading', level: 1, text: `Page ${page}`, page });
      if (lines.length > 0) {
        blocks.push({ kind: 'text', text: lines.join('\n'), page });
      }
    }
    return blocks;
  } finally {
    await pdfLoadingTask.destroy();
  }
}
