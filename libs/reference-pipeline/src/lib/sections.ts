/**
 * One heading or one piece of text, such as a paragraph of a web page or the
 * lines of one PDF page. `htmlToBlocks` and `pdfToBlocks` both return a list of
 * blocks. With one list type for both formats, `blocksToDocument` builds the
 * sections of web pages and PDFs with the same code.
 *
 * The library does not store blocks. They exist only while
 * `buildReferenceLibrary` converts a source.
 *
 * A text block holds markdown from a web page or plain text from a PDF.
 */
export type Block =
  | { kind: 'heading'; level: number; text: string }
  | { kind: 'text'; text: string };

/**
 * A heading and the text under it, up to the next heading. The list of a
 * reference's sections is its outline. The chat agent reads the outline to
 * choose what to read.
 *
 * `blocksToDocument` makes the sections with these rules.
 *
 * - Each heading starts a section. A heading nested under another, such as an
 *   `<h3>` after an `<h2>`, starts a subsection.
 * - Text before the first heading forms an "Opening text" section.
 * - A heading with no text of its own is still a section, with empty text.
 *
 * The library stores a reference's sections in reading order, as JSON in the
 * `sections` column of its `documents` row. `textStart` and `textEnd` are
 * JavaScript string indexes into `content_md`.
 * `content_md.slice(textStart, textEnd)` is a section's text, which omits its
 * heading line and any subsections.
 */
export type Section = {
  /** Made from the title, such as `blood-pressure-goals`. Unique in the reference. */
  sectionId: string;
  /** The parent section's `sectionId`, or null for a top-level section. */
  parentId: string | null;
  /** The heading's text, or "Opening text" for text before the first heading. */
  title: string;
  textStart: number;
  /** Equal to `textStart` when the heading has no text of its own. */
  textEnd: number;
};

/**
 * Up to 10,000 characters of one section's text. A section can be too long to
 * read at once. The chat agent searches and reads parts, not whole sections.
 *
 * A section has zero or more parts, and a part never continues into the next
 * section. `splitIntoParts` says where a part ends.
 *
 * The library stores each part as one `parts_fts` row, which holds the text and
 * indexes it for search.
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
 * Builds a reference's markdown, sections and parts from its blocks, once for
 * each source that `buildReferenceLibrary` fetches.
 *
 * Each heading becomes a `#` line in the markdown, with one `#` per level.
 * {@link Section} lists how headings become sections. The same blocks always
 * give the same markdown, sections and parts.
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
 * Splits one section's text into parts of at most 10,000 characters, for
 * `blocksToDocument`.
 *
 * A part ends at the last paragraph break that fits. If there is no paragraph
 * break, it ends at the last line break. If there is no line break, it ends at
 * the last space. If there is no space, it ends at 10,000 characters. Parts
 * omit the whitespace where they split.
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
