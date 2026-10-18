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
 * They are equal when the heading has no text of its own.
 */
export type Section = {
  sectionId: string;
  parentId: string | null;
  title: string;
  textStart: number;
  textEnd: number;
};

/** One part of a section's text, numbered from 1 within the section. */
export type Part = { sectionId: string; part: number; text: string };

const TEXT_BEFORE_FIRST_HEADING_TITLE = 'Opening text';
const PART_MAX_CHARS = 10000;

/**
 * Writes a document's blocks as one markdown document, and lists its sections,
 * one per heading, nested as the headings nest.
 *
 * - Headings become `#` lines, one `#` per level.
 * - Text before the first heading becomes an "Opening text" section.
 * - A heading with no text of its own is still a section.
 * - It makes section ids from titles, unique in the document. A repeated title
 *   gets `-2`, `-3` and so on.
 * - It splits each section's text into parts of at most 10,000 characters. A
 *   part ends at a paragraph break, line break or space (see
 *   {@link splitIntoParts}).
 *
 * @param blocks `Block[]`. A document's blocks in reading order.
 * @returns `{ markdown: string; sections: Section[]; parts: Part[] }`. The
 * sections and parts are in reading order.
 *
 * @example
 * blocksToDocument([
 *   { kind: 'heading', level: 1, text: 'Goals' },
 *   { kind: 'text', text: 'Below 130.' },
 * ]);
 * // {
 * //   markdown: '# Goals\n\nBelow 130.',
 * //   sections: [{ sectionId: 'goals', parentId: null, title: 'Goals', textStart: 9, textEnd: 19 }],
 * //   parts: [{ sectionId: 'goals', part: 1, text: 'Below 130.' }],
 * // }
 */
export function blocksToDocument(blocks: Block[]): {
  markdown: string;
  sections: Section[];
  parts: Part[];
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
      append(`${'#'.repeat(block.level)} ${block.text}`);
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
  const parts: Part[] = [];
  for (const section of sections) {
    const texts = splitIntoParts(
      markdown.slice(section.textStart, section.textEnd),
    );
    texts.forEach((text, index) =>
      parts.push({ sectionId: section.sectionId, part: index + 1, text }),
    );
  }
  return { markdown, sections, parts };
}

/**
 * Splits text into parts of at most 10,000 characters. A part ends at the last
 * paragraph break that fits, or else the last line break, or else the last
 * space. Text with none of these is cut at 10,000 characters. The break itself
 * belongs to no part.
 *
 * @param text `string`. One section's text.
 * @returns `string[]`. The parts in order. Empty for empty text.
 *
 * @example
 * splitIntoParts('Two doses.\n\nGive at 12 months.');
 * // ['Two doses.\n\nGive at 12 months.']
 */
export function splitIntoParts(text: string): string[] {
  const parts: string[] = [];
  let start = 0;
  while (start < text.length) {
    let end = Math.min(start + PART_MAX_CHARS, text.length);
    if (end < text.length) {
      for (const separator of ['\n\n', '\n', ' ']) {
        const at = text.lastIndexOf(separator, end);
        if (at > start) {
          end = at;
          break;
        }
      }
    }
    parts.push(text.slice(start, end));
    start = end;
    while (/\s/.test(text.charAt(start))) {
      start++;
    }
  }
  return parts;
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
