/**
 * One heading or run of text from a parsed document. A heading's text is plain.
 * A text block's text is markdown from a webpage or plain text from a PDF.
 * `page` is the PDF page the block is on. It is null for a webpage.
 */
export type Block =
  | { kind: 'heading'; level: number; text: string; page: number | null }
  | { kind: 'text'; text: string; page: number | null };

/**
 * One heading of a stored document and the text under it, up to the next
 * heading. `textStart` and `textEnd` are offsets into the document's markdown.
 * They are equal when the heading has no text of its own.
 */
export type Section = {
  sectionId: string;
  parentId: string | null;
  title: string;
  pages: { start: number; end: number } | null;
  textStart: number;
  textEnd: number;
};

const TEXT_BEFORE_FIRST_HEADING_TITLE = 'Opening text';

/**
 * Writes a document's blocks as one markdown document, and lists its sections,
 * one per heading, nested as the headings nest.
 *
 * - Headings become `#` lines, one `#` per level up to six.
 * - Each new PDF page starts with a `<!-- page N -->` line.
 * - Text before the first heading becomes an "Opening text" section.
 * - A heading with no text of its own is still a section.
 * - It makes section ids from titles, unique in the document. A repeated title
 *   gets `-2`, `-3` and so on.
 *
 * @param blocks `Block[]`. A document's blocks in reading order.
 * @returns `{ markdown: string; sections: Section[] }`. The sections are in
 * reading order. A PDF section's `pages` are its first and last page. They are
 * null for a webpage.
 *
 * @example
 * blocksToDocument([
 *   { kind: 'heading', level: 1, text: 'Goals', page: null },
 *   { kind: 'text', text: 'Below 130.', page: null },
 * ]);
 * // {
 * //   markdown: '# Goals\n\nBelow 130.',
 * //   sections: [{ sectionId: 'goals', parentId: null, title: 'Goals', pages: null, textStart: 9, textEnd: 19 }],
 * // }
 */
export function blocksToDocument(blocks: Block[]): {
  markdown: string;
  sections: Section[];
} {
  let markdown = '';
  const append = (text: string) => {
    markdown = markdown === '' ? text : `${markdown}\n\n${text}`;
  };
  const sections: Section[] = [];
  const openHeadings: { level: number; sectionId: string }[] = [];
  const usedIds = new Set<string>();
  let page: number | null = null;
  const startSection = (title: string, parentId: string | null): Section => {
    const section: Section = {
      sectionId: uniqueSlug(title, usedIds),
      parentId,
      title,
      pages: page === null ? null : { start: page, end: page },
      textStart: markdown.length,
      textEnd: markdown.length,
    };
    sections.push(section);
    return section;
  };

  for (const block of blocks) {
    if (block.page !== null && block.page !== page) {
      page = block.page;
      append(`<!-- page ${page} -->`);
    }
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
      if (block.page !== null && section.pages) {
        section.pages.end = block.page;
      }
    }
  }
  return { markdown, sections };
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
