import { escapeMarkdown } from './escapeMarkdown';
import { Block } from './sections';

type PdfLine = { page: number; size: number; y: number; text: string };

const HEADING_MIN_EXTRA_FONT_POINTS = 2;
const SAME_PARAGRAPH_MAX_GAP_IN_LINE_HEIGHTS = 1.8;
const REPEATED_LINE_CHECK_MIN_PAGES = 4;

/**
 * Reads the text lines of a PDF with pdf.js.
 *
 * It joins pieces of text at the same vertical position into one line, at the
 * largest of their font sizes. It collapses whitespace and skips empty lines.
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
      let open = false;
      for (const item of content.items) {
        if (!('str' in item)) {
          continue;
        }
        const y = Math.round(item.transform[5]);
        const last = pageLines[pageLines.length - 1];
        if (open && last && Math.abs(last.y - y) > 1) {
          open = false;
        }
        if (item.str) {
          const size = Math.round(item.height * 10) / 10;
          if (open && last) {
            last.size = Math.max(last.size, size);
            last.text += item.str;
          } else {
            pageLines.push({ page, size, y, text: item.str });
            open = true;
          }
        }
        if (item.hasEOL) {
          open = false;
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
 * Turns PDF lines into heading and text blocks.
 *
 * - In a document of 4 or more pages, it drops a line that repeats on more than
 *   half the pages. A title or page number at the top of each page is such a
 *   line.
 * - A line at least 2 points larger than the most common font size is a
 *   heading. Larger sizes are higher levels.
 * - Other lines join into a paragraph until a gap of more than 1.8 line
 *   heights, a move up the page, or a new page.
 * - It escapes paragraph text as markdown. Heading text stays plain.
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
 * //   { kind: 'heading', level: 1, text: 'Recommendations', page: 1 },
 * //   { kind: 'text', text: 'We recommend a goal below 130 mmHg.', page: 1 },
 * // ]
 */
export function pdfLinesToBlocks(lines: PdfLine[]): Block[] {
  const linesWithoutRepeats = dropLinesRepeatedOnMostPages(lines);
  const bodyFontSize = mostCommonFontSize(linesWithoutRepeats);
  const headingSizes = [
    ...new Set(
      linesWithoutRepeats
        .filter((l) => l.size >= bodyFontSize + HEADING_MIN_EXTRA_FONT_POINTS)
        .map((l) => l.size),
    ),
  ].sort((a, b) => b - a);

  const blocks: Block[] = [];
  let previous: PdfLine | null = null;
  for (const line of linesWithoutRepeats) {
    const level = headingSizes.indexOf(line.size) + 1;
    const isHeading = level > 0;
    const last = blocks[blocks.length - 1];
    // A line above the previous one starts a new column or text box.
    const continues =
      previous !== null &&
      last !== undefined &&
      previous.page === line.page &&
      previous.size === line.size &&
      previous.y >= line.y &&
      previous.y - line.y <= line.size * SAME_PARAGRAPH_MAX_GAP_IN_LINE_HEIGHTS;
    if (continues && isHeading === (last.kind === 'heading')) {
      last.text = `${last.text} ${line.text}`;
    } else if (isHeading) {
      blocks.push({ kind: 'heading', level, text: line.text, page: line.page });
    } else {
      blocks.push({ kind: 'text', text: line.text, page: line.page });
    }
    previous = line;
  }
  return blocks.map((block) =>
    block.kind === 'text'
      ? { ...block, text: escapeMarkdown(block.text) }
      : block,
  );
}

function mostCommonFontSize(lines: PdfLine[]): number {
  const charsBySize = new Map<number, number>();
  for (const line of lines) {
    charsBySize.set(
      line.size,
      (charsBySize.get(line.size) ?? 0) + line.text.length,
    );
  }
  let best = 0;
  let bestChars = -1;
  for (const [size, chars] of charsBySize) {
    if (chars > bestChars) {
      best = size;
      bestChars = chars;
    }
  }
  return best;
}

function dropLinesRepeatedOnMostPages(lines: PdfLine[]): PdfLine[] {
  const pageCount = new Set(lines.map((l) => l.page)).size;
  if (pageCount < REPEATED_LINE_CHECK_MIN_PAGES) {
    return lines;
  }
  const pagesByKey = new Map<string, Set<number>>();
  for (const line of lines) {
    const key = textIgnoringNumbersAndCase(line.text);
    pagesByKey.set(key, (pagesByKey.get(key) ?? new Set()).add(line.page));
  }
  return lines.filter(
    (line) =>
      (pagesByKey.get(textIgnoringNumbersAndCase(line.text))?.size ?? 0) <=
      pageCount / 2,
  );
}

function textIgnoringNumbersAndCase(text: string): string {
  return text.replace(/\d+/g, '#').toLowerCase();
}
