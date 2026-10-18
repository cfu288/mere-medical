/**
 * One heading or run of text from a parsed page. `htmlToBlocks` and
 * `pdfToBlocks` both return blocks, and `blocksToDocument` groups them into
 * sections. The library stores the sections, not the blocks. The README section
 * "Concepts" compares them.
 *
 * A text block holds markdown from a web page or plain text from a PDF.
 */
export type Block =
  | { kind: 'heading'; level: number; text: string }
  | { kind: 'text'; text: string };

/**
 * One heading block and the text blocks after it, up to the next heading. Text
 * before the first heading forms an "Opening text" section. Each PDF page gets a
 * "Page N" heading.
 *
 * The `sections` column holds a reference's sections in reading order, and the
 * chat agent lists them as the reference's outline. `textStart` and `textEnd`
 * locate a section's text in `content_md`.
 */
export type Section = {
  /**
   * Made from the title, unique in the reference. The chat agent asks for a section
   * by it.
   */
  sectionId: string;
  /** The `sectionId` of the heading this one sits under, or null at the top. */
  parentId: string | null;
  /** The heading's text, or "Opening text" for text before the first heading. */
  title: string;
  /** Where the section's text starts in `content_md`, as a JavaScript string index. */
  textStart: number;
  /**
   * Where the section's text ends in `content_md`. Equal to `textStart` when the
   * heading has no text of its own.
   */
  textEnd: number;
};

/**
 * Up to 10,000 characters of one section's text, stored as a `parts_fts` row.
 * The chat agent searches parts to find where a term appears in a reference. It
 * reads a long section one part at a time.
 */
export type Part = {
  sectionId: string;
  /** Numbered from 1 within the section. */
  part: number;
  text: string;
};

const TEXT_BEFORE_FIRST_HEADING_TITLE = 'Opening text';
const PART_MAX_CHARS = 10000;

/**
 * Turns a source's blocks into what `writeReference` stores.
 * `buildReferenceLibrary` calls it once per source.
 *
 * It writes the blocks as one markdown document. Each heading becomes a section,
 * nested as the headings nest. `splitIntoParts` splits each section's text into
 * parts. The README section "Converting a reference" lists the rules.
 *
 * @param blocks `Block[]`. A source's blocks in reading order.
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
 * Splits one section's text into parts of at most 10,000 characters.
 * `blocksToDocument` calls it.
 *
 * A part ends at the last paragraph break that fits, or else the last line break,
 * or else the last space. Text with none of these is cut at 10,000 characters.
 * The whitespace at a break, and any after it, belongs to no part.
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
