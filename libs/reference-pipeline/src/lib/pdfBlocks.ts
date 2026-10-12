import { escapeMarkdown } from './escapeMarkdown';
import { Block } from './sections';

type PdfLine = { page: number; size: number; y: number; text: string };

const HEADING_MIN_EXTRA_PT = 2;
const PARAGRAPH_GAP_LINE_HEIGHTS = 1.8;
const FURNITURE_MIN_PAGES = 4;

/**
 * Reads the text lines of a PDF with pdf.js.
 *
 * Text items drawn at the same height are joined into one line, at the
 * largest of their font sizes. Whitespace is collapsed and empty lines are
 * skipped.
 *
 * @param bytes `Uint8Array`. The PDF file.
 * @returns `Promise<PdfLine[]>`. Each line's page (from 1), font size, height
 * on the page and text, in drawing order.
 *
 * @example
 * // A one-page PDF with a 14 pt heading above an 11 pt line.
 * await pdfLines(readFileSync('guideline.pdf'));
 * // [
 * //   { page: 1, size: 14, y: 720, text: 'I. Introduction' },
 * //   { page: 1, size: 11, y: 700, text: 'Tdap booster every 10 years.' },
 * // ]
 */
export async function pdfLines(bytes: Uint8Array): Promise<PdfLine[]> {
  // pdf.js asks for its legacy build in Node.
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const task = pdfjs.getDocument({ data: bytes, verbosity: 0 });
  try {
    const doc = await task.promise;
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
    await task.destroy();
  }
}

/**
 * Turns PDF lines into heading and text blocks.
 *
 * - In a document of 4 or more pages, a line that repeats on more than half
 *   the pages is dropped. Running headers and page numbers are such lines.
 * - The font size with the most text is the body size. A line at least 2 pt
 *   larger is a heading, and larger sizes are higher levels.
 * - Body lines join into a paragraph until a gap of more than 1.8 line
 *   heights, a move up the page, or a new page.
 * - Body text is escaped as markdown. Heading text stays plain.
 *
 * @param lines `PdfLine[]`. From {@link pdfLines}.
 * @returns `Block[]`. Blocks in reading order, each with its page.
 *
 * @example
 * linesToBlocks([
 *   { page: 1, size: 14, y: 700, text: 'Recommendations' },
 *   { page: 1, size: 10, y: 680, text: 'We recommend a goal' },
 *   { page: 1, size: 10, y: 668, text: 'below 130 mmHg.' },
 * ]);
 * // [
 * //   { kind: 'heading', level: 1, text: 'Recommendations', page: 1 },
 * //   { kind: 'text', text: 'We recommend a goal below 130 mmHg.', page: 1 },
 * // ]
 */
export function linesToBlocks(lines: PdfLine[]): Block[] {
  const kept = withoutFurniture(lines);
  const body = bodySize(kept);
  const headingSizes = [
    ...new Set(
      kept
        .filter((l) => l.size >= body + HEADING_MIN_EXTRA_PT)
        .map((l) => l.size),
    ),
  ].sort((a, b) => b - a);

  const blocks: Block[] = [];
  let previous: PdfLine | null = null;
  for (const line of kept) {
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
      previous.y - line.y <= line.size * PARAGRAPH_GAP_LINE_HEIGHTS;
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

function bodySize(lines: PdfLine[]): number {
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

function withoutFurniture(lines: PdfLine[]): PdfLine[] {
  const pageCount = new Set(lines.map((l) => l.page)).size;
  if (pageCount < FURNITURE_MIN_PAGES) {
    return lines;
  }
  const pagesByKey = new Map<string, Set<number>>();
  for (const line of lines) {
    const key = furnitureKey(line.text);
    pagesByKey.set(key, (pagesByKey.get(key) ?? new Set()).add(line.page));
  }
  return lines.filter(
    (line) =>
      (pagesByKey.get(furnitureKey(line.text))?.size ?? 0) <= pageCount / 2,
  );
}

function furnitureKey(text: string): string {
  return text.replace(/\d+/g, '#').toLowerCase();
}
