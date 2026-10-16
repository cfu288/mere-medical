import { Block } from './sections';

type PdfLine = { page: number; size: number; y: number; text: string };

const SAME_PARAGRAPH_MAX_GAP_IN_FONT_SIZES = 1.8;
const REPEATED_LINE_CHECK_MIN_PAGES = 4;

/**
 * Reads the text lines of a PDF with pdf.js.
 *
 * It joins pieces of text into one line until pdf.js marks the end of the line,
 * at the largest of their font sizes. A raised superscript stays on its line.
 * It collapses whitespace and skips empty lines.
 *
 * @param bytes `Uint8Array`. The PDF file.
 * @returns `Promise<PdfLine[]>`. Each line's page (from 1), font size, vertical
 * position on the page and text, in the order the PDF stores them.
 *
 * @example
 * // A one-page PDF with a 14 pt heading above an 11 pt line.
 * await readPdfLines(readFileSync('guideline.pdf'));
 * // [
 * //   { page: 1, size: 14, y: 720, text: 'I. Introduction' },
 * //   { page: 1, size: 11, y: 700, text: 'Tdap booster every 10 years.' },
 * // ]
 */
export async function readPdfLines(bytes: Uint8Array): Promise<PdfLine[]> {
  // pdf.js asks for its legacy build in Node.
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const pdfLoadingTask = pdfjs.getDocument({ data: bytes, verbosity: 0 });
  try {
    const doc = await pdfLoadingTask.promise;
    const lines: PdfLine[] = [];
    for (let page = 1; page <= doc.numPages; page++) {
      const content = await (await doc.getPage(page)).getTextContent();
      const pageLines: PdfLine[] = [];
      let lineInProgress: PdfLine | null = null;
      for (const item of content.items) {
        if (!('str' in item)) {
          continue;
        }
        const y = Math.round(item.transform[5]);
        if (item.str) {
          const size = Math.round(item.height * 10) / 10;
          if (lineInProgress) {
            lineInProgress.size = Math.max(lineInProgress.size, size);
            lineInProgress.text += item.str;
          } else {
            lineInProgress = { page, size, y, text: item.str };
            pageLines.push(lineInProgress);
          }
        }
        if (item.hasEOL) {
          lineInProgress = null;
        }
      }
      for (const line of pageLines) {
        const text = line.text.replace(/\s+/g, ' ').trim();
        if (text) {
          lines.push({ ...line, text });
        }
      }
    }
    return lines;
  } finally {
    await pdfLoadingTask.destroy();
  }
}

/**
 * Turns PDF lines into blocks, one section per page. Each page starts with a
 * heading titled "Page N". Most PDFs have no heading markup.
 *
 * - In a document of 4 or more pages, it drops a line that repeats on more than
 *   half the pages. Its place on the page does not matter. A running title is
 *   such a line. In a line with words, any number matches any other number.
 *   "Page 3" repeats "Page 4". A line of only digits repeats when it is the
 *   page number plus the same amount on each page, as page numbers are.
 * - Lines join into a paragraph. A gap of more than 1.8 times the font size
 *   starts a new paragraph. So does a move up the page, a new font size or a
 *   new page.
 * - It keeps the text as written.
 *
 * @param lines `PdfLine[]`. From {@link readPdfLines}.
 * @returns `Block[]`. Blocks in reading order, each with its page.
 *
 * @example
 * pdfLinesToBlocks([
 *   { page: 1, size: 14, y: 700, text: 'Recommendations' },
 *   { page: 1, size: 10, y: 680, text: 'We recommend a goal' },
 *   { page: 1, size: 10, y: 668, text: 'below 130 mmHg.' },
 * ]);
 * // [
 * //   { kind: 'heading', level: 1, text: 'Page 1', page: 1 },
 * //   { kind: 'text', text: 'Recommendations', page: 1 },
 * //   { kind: 'text', text: 'We recommend a goal below 130 mmHg.', page: 1 },
 * // ]
 */
export function pdfLinesToBlocks(lines: PdfLine[]): Block[] {
  const blocks: Block[] = [];
  let previous: { line: PdfLine; block: Block } | null = null;
  for (const line of dropLinesRepeatedOnMostPages(lines)) {
    if (previous && continuesBlock(previous.line, line)) {
      previous.block.text = `${previous.block.text} ${line.text}`;
      previous = { line, block: previous.block };
      continue;
    }
    if (previous?.line.page !== line.page) {
      blocks.push({
        kind: 'heading',
        level: 1,
        text: `Page ${line.page}`,
        page: line.page,
      });
    }
    const block: Block = { kind: 'text', text: line.text, page: line.page };
    blocks.push(block);
    previous = { line, block };
  }
  return blocks;
}

function continuesBlock(previous: PdfLine, line: PdfLine): boolean {
  return (
    previous.page === line.page &&
    previous.size === line.size &&
    previous.y >= line.y &&
    previous.y - line.y <= line.size * SAME_PARAGRAPH_MAX_GAP_IN_FONT_SIZES
  );
}

function dropLinesRepeatedOnMostPages(lines: PdfLine[]): PdfLine[] {
  const pageCount = new Set(lines.map((l) => l.page)).size;
  if (pageCount < REPEATED_LINE_CHECK_MIN_PAGES) {
    return lines;
  }
  const pagesByKey = new Map<string, Set<number>>();
  for (const line of lines) {
    const key = repeatedLineKey(line);
    pagesByKey.set(key, (pagesByKey.get(key) ?? new Set()).add(line.page));
  }
  return lines.filter(
    (line) =>
      (pagesByKey.get(repeatedLineKey(line))?.size ?? 0) <= pageCount / 2,
  );
}

function repeatedLineKey(line: PdfLine): string {
  if (/^\d+$/.test(line.text)) {
    return `page number ${Number(line.text) - line.page}`;
  }
  return line.text.replace(/\d+/g, '#').toLowerCase();
}
