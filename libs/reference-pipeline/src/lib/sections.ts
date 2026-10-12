import { Block, PagedBlock } from './blocks';

export type ParsedDocument =
  | { kind: 'paged'; blocks: PagedBlock[] }
  | { kind: 'webpage'; blocks: Block[] };

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
const OPENING_TITLE = 'Opening text';

// Back matter of the VA-DoD guidelines that holds no clinical guidance.
const DROPPED_TITLES = [
  /^references$/,
  /participant list/,
  /abbreviation/,
  /search terms and strategy/,
  /recommendation categorization/,
];

type Draft<B> = {
  title: string;
  parent: Draft<B> | null;
  pages: number[];
  body: B[];
};

/**
 * Groups a document's blocks into sections, one per heading, nested as the
 * headings nest.
 *
 * - Text before the first heading becomes an "Opening text" section.
 * - A section titled as a reference list, participant list, abbreviations,
 *   search strategy or recommendation categorization is dropped with its
 *   subsections.
 * - A section with no text and no subsections with text is dropped.
 * - A PDF section over 12,000 characters gets a "Page N" subsection per page.
 * - Section ids are made from titles and are unique in the document. A
 *   repeated title gets `-2`, `-3` and so on.
 *
 * @param doc `ParsedDocument`. Paged blocks from a PDF or blocks from a
 * webpage.
 * @returns `{ sections: Section[]; dropped: string[] }`. The sections in
 * reading order, and the titles of the dropped sections in that list.
 * A PDF section's location gives its first and last page.
 *
 * @example
 * buildSections({
 *   kind: 'webpage',
 *   blocks: [
 *     { kind: 'text', text: 'Updated 2026.' },
 *     { kind: 'heading', level: 1, text: 'Goals' },
 *     { kind: 'text', text: 'Below 130.' },
 *     { kind: 'heading', level: 1, text: 'References' },
 *     { kind: 'text', text: '1. Smith.' },
 *   ],
 * });
 * // {
 * //   sections: [
 * //     { sectionId: 'opening-text', parentId: null, title: 'Opening text', location: { kind: 'webpage' }, contentMd: 'Updated 2026.' },
 * //     { sectionId: 'goals', parentId: null, title: 'Goals', location: { kind: 'webpage' }, contentMd: 'Below 130.' },
 * //   ],
 * //   dropped: ['References'],
 * // }
 */
export function buildSections(doc: ParsedDocument): {
  sections: Section[];
  dropped: string[];
} {
  return doc.kind === 'paged'
    ? finish(splitLongPages(drafts(doc.blocks, (b) => [b.page])), (draft) => ({
        kind: 'pages',
        start: Math.min(...draft.pages),
        end: Math.max(...draft.pages),
      }))
    : finish(
        drafts(doc.blocks, () => []),
        () => ({ kind: 'webpage' }),
      );
}

function drafts<B extends Block>(
  blocks: B[],
  pagesOf: (block: B) => number[],
): Draft<B>[] {
  const all: Draft<B>[] = [];
  const stack: { level: number; draft: Draft<B> }[] = [];
  let current: Draft<B> | null = null;
  for (const block of blocks) {
    if (block.kind === 'heading') {
      while (stack.length > 0 && stack[stack.length - 1].level >= block.level) {
        stack.pop();
      }
      current = {
        title: block.text,
        parent: stack[stack.length - 1]?.draft ?? null,
        pages: pagesOf(block),
        body: [],
      };
      stack.push({ level: block.level, draft: current });
      all.push(current);
    } else {
      if (!current) {
        current = { title: OPENING_TITLE, parent: null, pages: [], body: [] };
        all.push(current);
      }
      current.body.push(block);
      current.pages.push(...pagesOf(block));
    }
  }
  return all;
}

function splitLongPages(all: Draft<PagedBlock>[]): Draft<PagedBlock>[] {
  return all.flatMap((draft) => {
    if (bodyText(draft.body).length <= MAX_PDF_SECTION_CHARS) {
      return [draft];
    }
    const pages = [...new Set(draft.body.map((b) => b.page))];
    const children = pages.map((page) => ({
      title: `Page ${page}`,
      parent: draft,
      pages: [page],
      body: draft.body.filter((b) => b.page === page),
    }));
    const headingPages = draft.pages.filter(
      (p) => !draft.body.some((b) => b.page === p),
    );
    draft.body = [];
    draft.pages = headingPages.length > 0 ? headingPages : [pages[0]];
    return [draft, ...children];
  });
}

function finish<B extends Block>(
  all: Draft<B>[],
  locate: (draft: Draft<B>) => Location,
): { sections: Section[]; dropped: string[] } {
  const droppedDrafts = new Set<Draft<B>>();
  const dropped: string[] = [];
  for (const draft of all) {
    if (draft.parent && droppedDrafts.has(draft.parent)) {
      droppedDrafts.add(draft);
    } else if (isDroppedTitle(draft.title)) {
      droppedDrafts.add(draft);
      dropped.push(draft.title);
    }
  }

  const blank = new Set<Draft<B>>();
  for (const draft of [...all].reverse()) {
    const children = all.filter(
      (other) => other.parent === draft && !droppedDrafts.has(other),
    );
    if (bodyText(draft.body) === '' && children.every((c) => blank.has(c))) {
      blank.add(draft);
    }
  }

  const ids = new Map<Draft<B>, string>();
  const taken = new Set<string>();
  const sections: Section[] = [];
  for (const draft of all) {
    if (droppedDrafts.has(draft) || blank.has(draft)) {
      continue;
    }
    const base = slug(draft.title);
    let sectionId = base;
    for (let n = 2; taken.has(sectionId); n++) {
      sectionId = `${base}-${n}`;
    }
    taken.add(sectionId);
    ids.set(draft, sectionId);
    sections.push({
      sectionId,
      parentId: draft.parent ? ids.get(draft.parent) ?? null : null,
      title: draft.title,
      location: locate(draft),
      contentMd: bodyText(draft.body),
    });
  }
  return { sections, dropped };
}

function bodyText(body: Block[]): string {
  return body.map((b) => b.text).join('\n\n');
}

function isDroppedTitle(title: string): boolean {
  const normalized = title
    .toLowerCase()
    .replace(/^appendix [a-z0-9]+[.:]?\s*/, '')
    .trim();
  return DROPPED_TITLES.some((pattern) => pattern.test(normalized));
}

function slug(title: string): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/, '');
  return base || 'section';
}
