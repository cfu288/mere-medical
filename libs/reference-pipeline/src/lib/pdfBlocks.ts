import { PagedBlock } from './blocks';

type PdfLine = { page: number; size: number; y: number; text: string };

const HEADING_MIN_EXTRA_PT = 2;
const PARAGRAPH_GAP_LINE_HEIGHTS = 1.8;
const FURNITURE_MIN_PAGES = 4;

export async function pdfLines(bytes: Uint8Array): Promise<PdfLine[]> {
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

export function linesToBlocks(lines: PdfLine[]): PagedBlock[] {
  const kept = withoutFurniture(lines);
  const body = bodySize(kept);
  const headingSizes = [
    ...new Set(
      kept
        .filter((l) => l.size >= body + HEADING_MIN_EXTRA_PT)
        .map((l) => l.size),
    ),
  ].sort((a, b) => b - a);

  const blocks: PagedBlock[] = [];
  let previous: PdfLine | null = null;
  for (const line of kept) {
    const level = headingSizes.indexOf(line.size) + 1;
    const last = blocks[blocks.length - 1];
    const continues =
      previous !== null &&
      last !== undefined &&
      previous.page === line.page &&
      previous.size === line.size &&
      previous.y >= line.y &&
      previous.y - line.y <= line.size * PARAGRAPH_GAP_LINE_HEIGHTS;
    if (continues && level > 0 === (last.kind === 'heading')) {
      last.text = `${last.text} ${line.text}`;
    } else if (level > 0) {
      blocks.push({ kind: 'heading', level, text: line.text, page: line.page });
    } else {
      blocks.push({ kind: 'text', text: line.text, page: line.page });
    }
    previous = line;
  }
  return blocks;
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
