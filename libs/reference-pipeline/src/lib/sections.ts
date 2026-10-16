/**
 * One heading or run of text from a parsed document. A heading's text is plain.
 * A text block's text is markdown from a webpage or plain text from a PDF.
 */
export type Block =
  | { kind: 'heading'; level: number; text: string }
  | { kind: 'text'; text: string };

/**
 * One heading of a stored document and the text under it, up to the next
 * heading. `textStart` and `textEnd` are offsets into the document's markdown.
 * They are equal when the heading has no text of its own. `pageCount` is the
 * number of pages its text splits into, and 0 when it has no text.
 */
export type Section = {
  sectionId: string;
  parentId: string | null;
  title: string;
  textStart: number;
  textEnd: number;
  pageCount: number;
};

/** One page of a section's text, numbered from 1 within the section. */
export type Page = { sectionId: string; page: number; text: string };

const TEXT_BEFORE_FIRST_HEADING_TITLE = 'Opening text';
const PAGE_MAX_CHARS = 10000;

/**
 * Writes a document's blocks as one markdown document, and lists its sections,
 * one per heading, nested as the headings nest.
 *
 * - Headings become `#` lines, one `#` per level up to six.
 * - Text before the first heading becomes an "Opening text" section.
 * - A heading with no text of its own is still a section.
 * - It makes section ids from titles, unique in the document. A repeated title
 *   gets `-2`, `-3` and so on.
 * - It splits each section's text into pages of at most 10,000 characters. A
 *   page ends at the last paragraph break that fits. A longer paragraph is cut
 *   at 10,000 characters.
 *
 * @param blocks `Block[]`. A document's blocks in reading order.
 * @returns `{ markdown: string; sections: Section[]; pages: Page[] }`. The
 * sections and pages are in reading order.
 *
 * @example
 * blocksToDocument([
 *   { kind: 'heading', level: 1, text: 'Goals' },
 *   { kind: 'text', text: 'Below 130.' },
 * ]);
 * // {
 * //   markdown: '# Goals\n\nBelow 130.',
 * //   sections: [{ sectionId: 'goals', parentId: null, title: 'Goals', textStart: 9, textEnd: 19, pageCount: 1 }],
 * //   pages: [{ sectionId: 'goals', page: 1, text: 'Below 130.' }],
 * // }
 */
export function blocksToDocument(blocks: Block[]): {
  markdown: string;
  sections: Section[];
  pages: Page[];
} {
  let markdown = '';
  const append = (text: string) => {
    markdown = markdown === '' ? text : `${markdown}\n\n${text}`;
  };
  const sections: Section[] = [];
  const openHeadings: { level: number; sectionId: string }[] = [];
  const usedIds = new Set<string>();
  const startSection = (title: string, parentId: string | null): Section => {
    const section: Section = {
      sectionId: uniqueSlug(title, usedIds),
      parentId,
      title,
      textStart: markdown.length,
      textEnd: markdown.length,
      pageCount: 0,
    };
    sections.push(section);
    return section;
  };

  for (const block of blocks) {
    if (block.kind === 'heading') {
      while (
        openHeadings.length > 0 &&
        openHeadings[openHeadings.length - 1].level >= block.level
      ) {
        openHeadings.pop();
      }
      append(`${'#'.repeat(Math.min(block.level, 6))} ${block.text}`);
      const parentId = openHeadings[openHeadings.length - 1]?.sectionId ?? null;
      const section = startSection(block.text, parentId);
      openHeadings.push({ level: block.level, sectionId: section.sectionId });
    } else {
      const section =
        sections[sections.length - 1] ??
        startSection(TEXT_BEFORE_FIRST_HEADING_TITLE, null);
      append(block.text);
      if (section.textStart === section.textEnd) {
        section.textStart = markdown.length - block.text.length;
      }
      section.textEnd = markdown.length;
    }
  }
  const pages: Page[] = [];
  for (const section of sections) {
    const texts = splitIntoPages(
      markdown.slice(section.textStart, section.textEnd),
    );
    section.pageCount = texts.length;
    texts.forEach((text, index) =>
      pages.push({ sectionId: section.sectionId, page: index + 1, text }),
    );
  }
  return { markdown, sections, pages };
}

function splitIntoPages(text: string): string[] {
  const pages: string[] = [];
  let start = 0;
  while (start < text.length) {
    let end = Math.min(start + PAGE_MAX_CHARS, text.length);
    const paragraphBreak = text.lastIndexOf('\n\n', end);
    if (end < text.length && paragraphBreak > start) {
      end = paragraphBreak;
    }
    pages.push(text.slice(start, end));
    start = end;
    while (text[start] === '\n') {
      start++;
    }
  }
  return pages;
}

function uniqueSlug(title: string, usedIds: Set<string>): string {
  const base = slugifyTitle(title);
  let sectionId = base;
  for (let n = 2; usedIds.has(sectionId); n++) {
    sectionId = `${base}-${n}`;
  }
  usedIds.add(sectionId);
  return sectionId;
}

function slugifyTitle(title: string): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/, '');
  return base || 'section';
}
