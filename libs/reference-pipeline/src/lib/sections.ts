import { escapeMarkdown } from './escapeMarkdown';

/**
 * One heading or run of text from a parsed document. A heading's text is plain.
 * A text block's text is markdown. `page` is the PDF page the block is on. It is
 * null for a webpage.
 */
export type Block =
  | { kind: 'heading'; level: number; text: string; page: number | null }
  | { kind: 'text'; text: string; page: number | null };

export type Location =
  | { kind: 'pages'; start: number; end: number }
  | { kind: 'webpage' };

/**
 * One heading of a stored document and the text under it, up to the next
 * heading. `textStart` and `textEnd` are offsets into the document's markdown.
 * They are equal when the heading has no text of its own.
 */
export type Section = {
  sectionId: string;
  parentId: string | null;
  title: string;
  location: Location;
  textStart: number;
  textEnd: number;
};

const TEXT_BEFORE_FIRST_HEADING_TITLE = 'Opening text';

type SectionInProgress = {
  sectionId: string;
  parentId: string | null;
  title: string;
  pages: number[];
  textStart: number;
  textEnd: number;
  hasText: boolean;
};

/**
 * Writes a document's blocks as one markdown document, and lists its sections,
 * one per heading, nested as the headings nest.
 *
 * - Headings become `#` lines, one `#` per level up to six, with their text
 *   escaped. The section title keeps the plain text.
 * - Each new PDF page starts with a `<!-- page N -->` line.
 * - Text before the first heading becomes an "Opening text" section.
 * - A heading with no text of its own is still a section.
 * - It makes section ids from titles, unique in the document. A repeated title
 *   gets `-2`, `-3` and so on.
 *
 * @param blocks `Block[]`. A document's blocks in reading order.
 * @returns `{ markdown: string; sections: Section[] }`. The sections are in
 * reading order. A section with pages gives its first and last page as its
 * location.
 *
 * @example
 * blocksToDocument([
 *   { kind: 'heading', level: 1, text: 'Goals', page: null },
 *   { kind: 'text', text: 'Below 130.', page: null },
 * ]);
 * // {
 * //   markdown: '# Goals\n\nBelow 130.',
 * //   sections: [{ sectionId: 'goals', parentId: null, title: 'Goals', location: { kind: 'webpage' }, textStart: 9, textEnd: 19 }],
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
  const sections: SectionInProgress[] = [];
  const openHeadings: { level: number; section: SectionInProgress }[] = [];
  const usedIds = new Set<string>();
  let page: number | null = null;
  const startSection = (title: string, parentId: string | null) => {
    const section: SectionInProgress = {
      sectionId: uniqueSlug(title, usedIds),
      parentId,
      title,
      pages: page === null ? [] : [page],
      textStart: markdown.length,
      textEnd: markdown.length,
      hasText: false,
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
      append(
        `${'#'.repeat(Math.min(block.level, 6))} ${escapeMarkdown(block.text)}`,
      );
      const parent = openHeadings[openHeadings.length - 1]?.section ?? null;
      const section = startSection(block.text, parent?.sectionId ?? null);
      openHeadings.push({ level: block.level, section });
    } else {
      const section =
        sections[sections.length - 1] ??
        startSection(TEXT_BEFORE_FIRST_HEADING_TITLE, null);
      append(block.text);
      if (!section.hasText) {
        section.textStart = markdown.length - block.text.length;
        section.hasText = true;
      }
      section.textEnd = markdown.length;
      if (block.page !== null) {
        section.pages.push(block.page);
      }
    }
  }

  return {
    markdown,
    sections: sections.map((section) => ({
      sectionId: section.sectionId,
      parentId: section.parentId,
      title: section.title,
      location:
        section.pages.length > 0
          ? {
              kind: 'pages',
              start: Math.min(...section.pages),
              end: Math.max(...section.pages),
            }
          : { kind: 'webpage' },
      textStart: section.textStart,
      textEnd: section.textEnd,
    })),
  };
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
