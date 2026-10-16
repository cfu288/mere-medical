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
  | { kind: 'webpage'; url?: string };

export type Section = {
  sectionId: string;
  parentId: string | null;
  title: string;
  location: Location;
  contentMd: string;
};

// Font-size heading detection can miss PDF headings and leave one huge section.
const MAX_PDF_SECTION_CHARS = 12000;
const TEXT_BEFORE_FIRST_HEADING_TITLE = 'Opening text';

// Appendices that hold no clinical guidance, titled as in the VA-DoD guidelines.
const APPENDIX_TITLES = [
  /^references$/,
  /participant list/,
  /abbreviation/,
  /search terms and strategy/,
  /recommendation categorization/,
];

type SectionInProgress = {
  title: string;
  parent: SectionInProgress | null;
  pages: number[];
  body: Block[];
};

/**
 * Groups a document's blocks into sections, one per heading, nested as the
 * headings nest.
 *
 * - Text before the first heading becomes an "Opening text" section.
 * - It drops a section titled as a reference list, participant list,
 *   abbreviations, search strategy or recommendation categorization, with its
 *   subsections.
 * - It drops a section with no text and no subsections with text.
 * - A PDF section over 12,000 characters gets a "Page N" subsection per page.
 * - It makes section ids from titles, unique in the document. A
 *   repeated title gets `-2`, `-3` and so on.
 *
 * @param blocks `Block[]`. A document's blocks in reading order.
 * @returns `{ sections: Section[]; dropped: string[] }`. The sections in
 * reading order, and the titles of the dropped sections in that list.
 * A section with pages gives its first and last page as its location.
 *
 * @example
 * groupBlocksIntoSections([
 *   { kind: 'text', text: 'Updated 2026.', page: null },
 *   { kind: 'heading', level: 1, text: 'Goals', page: null },
 *   { kind: 'text', text: 'Below 130.', page: null },
 *   { kind: 'heading', level: 1, text: 'References', page: null },
 *   { kind: 'text', text: '1. Smith.', page: null },
 * ]);
 * // {
 * //   sections: [
 * //     { sectionId: 'opening-text', parentId: null, title: 'Opening text', location: { kind: 'webpage' }, contentMd: 'Updated 2026.' },
 * //     { sectionId: 'goals', parentId: null, title: 'Goals', location: { kind: 'webpage' }, contentMd: 'Below 130.' },
 * //   ],
 * //   dropped: ['References'],
 * // }
 */
export function groupBlocksIntoSections(blocks: Block[]): {
  sections: Section[];
  dropped: string[];
} {
  const sectionsInProgress = startNestedSectionAtEachHeading(blocks);
  const withLongPdfSectionsSplit =
    splitLongPdfSectionsByPage(sectionsInProgress);
  return toFinalSectionsWithoutAppendicesOrEmpty(withLongPdfSectionsSplit);
}

function startNestedSectionAtEachHeading(blocks: Block[]): SectionInProgress[] {
  const all: SectionInProgress[] = [];
  const stack: { level: number; section: SectionInProgress }[] = [];
  let current: SectionInProgress | null = null;
  for (const block of blocks) {
    const pages = block.page === null ? [] : [block.page];
    if (block.kind === 'heading') {
      while (stack.length > 0 && stack[stack.length - 1].level >= block.level) {
        stack.pop();
      }
      current = {
        title: block.text,
        parent: stack[stack.length - 1]?.section ?? null,
        pages,
        body: [],
      };
      stack.push({ level: block.level, section: current });
      all.push(current);
    } else {
      if (!current) {
        current = {
          title: TEXT_BEFORE_FIRST_HEADING_TITLE,
          parent: null,
          pages: [],
          body: [],
        };
        all.push(current);
      }
      current.body.push(block);
      current.pages.push(...pages);
    }
  }
  return all;
}

function splitLongPdfSectionsByPage(
  all: SectionInProgress[],
): SectionInProgress[] {
  return all.flatMap((section) => {
    if (
      section.pages.length === 0 ||
      joinBlockText(section.body).length <= MAX_PDF_SECTION_CHARS
    ) {
      return [section];
    }
    const pages = [...new Set(section.body.map((b) => b.page))];
    const children = pages.map((page) => ({
      title: `Page ${page}`,
      parent: section,
      pages: page === null ? [] : [page],
      body: section.body.filter((b) => b.page === page),
    }));
    const headingPages = section.pages.filter(
      (p) => !section.body.some((b) => b.page === p),
    );
    section.body = [];
    section.pages = headingPages.length > 0 ? headingPages : children[0].pages;
    return [section, ...children];
  });
}

function toFinalSectionsWithoutAppendicesOrEmpty(all: SectionInProgress[]): {
  sections: Section[];
  dropped: string[];
} {
  const droppedSections = new Set<SectionInProgress>();
  const dropped: string[] = [];
  for (const section of all) {
    if (section.parent && droppedSections.has(section.parent)) {
      droppedSections.add(section);
    } else if (isAppendixTitle(section.title)) {
      droppedSections.add(section);
      dropped.push(section.title);
    }
  }

  const blank = new Set<SectionInProgress>();
  for (const section of [...all].reverse()) {
    const children = all.filter(
      (other) => other.parent === section && !droppedSections.has(other),
    );
    if (
      joinBlockText(section.body) === '' &&
      children.every((c) => blank.has(c))
    ) {
      blank.add(section);
    }
  }

  const ids = new Map<SectionInProgress, string>();
  const usedIds = new Set<string>();
  const sections: Section[] = [];
  for (const section of all) {
    if (droppedSections.has(section) || blank.has(section)) {
      continue;
    }
    const base = slugifyTitle(section.title);
    let sectionId = base;
    for (let n = 2; usedIds.has(sectionId); n++) {
      sectionId = `${base}-${n}`;
    }
    usedIds.add(sectionId);
    ids.set(section, sectionId);
    sections.push({
      sectionId,
      parentId: section.parent ? ids.get(section.parent) ?? null : null,
      title: section.title,
      location:
        section.pages.length > 0
          ? {
              kind: 'pages',
              start: Math.min(...section.pages),
              end: Math.max(...section.pages),
            }
          : { kind: 'webpage' },
      contentMd: joinBlockText(section.body),
    });
  }
  return { sections, dropped };
}

function joinBlockText(body: Block[]): string {
  return body.map((b) => b.text).join('\n\n');
}

function isAppendixTitle(title: string): boolean {
  const normalized = title
    .toLowerCase()
    .replace(/^appendix [a-z0-9]+[.:]?\s*/, '')
    .trim();
  return APPENDIX_TITLES.some((pattern) => pattern.test(normalized));
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
