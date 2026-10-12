import { DatabaseSync } from 'node:sqlite';

import { isSafeUrl } from './htmlToMarkdown';

export type Finding = {
  check:
    | 'dead-end'
    | 'links-only'
    | 'html-tags'
    | 'unsafe-link'
    | 'duplicate-text'
    | 'missing-parent'
    | 'replacement-character'
    | 'short-reference'
    | 'search-index'
    | 'empty-library';
  reference: string;
  section: string | null;
  detail: string;
};

type SectionRow = {
  reference: string;
  section: string;
  parent: string | null;
  title: string;
  text: string;
};

type ReferenceRow = { id: string; title: string; summary: string };

/**
 * The rows the checks read. They are the library's references and sections
 * and the rows of its two search tables, in reading order.
 */
export type Library = {
  references: ReferenceRow[];
  sections: SectionRow[];
  referenceIndex: ReferenceRow[];
  sectionIndex: SectionRow[];
};

type Check = (library: Library) => Finding[];

const SHORT_REFERENCE_CHARS = 500;
const LINK = /!?\[[^\]]*\]\([^)]*\)/g;
const LINK_TARGET =
  /(?<!\\)!?\[[^\]]*\]\(\s*([^\s)]+)|(?<!\\)<([a-z][a-z0-9+.-]*:[^>\s]*)>/gi;
const HTML_TAG = /(?<!\\)<\/?([a-z][a-z0-9]*)\b[^>]*>/gi;

/**
 * Finds problems in a built library that make a section unreadable,
 * unreachable or misleading to the agent. Runs every check in this file.
 *
 * @param db `DatabaseSync`. From `openReferencesDb`.
 * @returns `Finding[]`. Grouped by check, in reading order within a check.
 * Empty for a clean library.
 *
 * @example
 * // The library holds one reference, 'measles', with one empty section 'doses'.
 * auditLibrary(db);
 * // [
 * //   { check: 'dead-end', reference: 'measles', section: 'doses', detail: 'no text and no subsections' },
 * //   { check: 'short-reference', reference: 'measles', section: null, detail: '0 characters of text' },
 * // ]
 */
export function auditLibrary(db: DatabaseSync): Finding[] {
  const library = loadLibrary(db);
  return CHECKS.flatMap((check) => check(library));
}

function loadLibrary(db: DatabaseSync): Library {
  return {
    references: db
      .prepare('SELECT id, title, summary FROM documents ORDER BY id')
      .all() as ReferenceRow[],
    sections: db
      .prepare(
        `SELECT document_id AS reference, section_id AS section, parent_id AS parent, title, content_md AS text
         FROM sections ORDER BY document_id, position`,
      )
      .all() as SectionRow[],
    referenceIndex: db
      .prepare('SELECT id, title, summary FROM documents_fts')
      .all() as ReferenceRow[],
    sectionIndex: db
      .prepare(
        `SELECT document_id AS reference, section_id AS section, NULL AS parent, title, content_md AS text
         FROM sections_fts`,
      )
      .all() as SectionRow[],
  };
}

function finding(
  check: Finding['check'],
  row: SectionRow,
  detail: string,
): Finding {
  return { check, reference: row.reference, section: row.section, detail };
}

function key(reference: string, section: string): string {
  return `${reference}/${section}`;
}

/**
 * Finds sections whose parent id names no section in the same reference.
 *
 * @param library `Library`. The library's rows, as `auditLibrary` loads them.
 * @returns `Finding[]`. One finding per problem, or none.
 *
 * @example
 * missingParents({ references: [], sections: [{ reference: 'measles', section: 'doses', parent: 'schedule', title: 'T', text: 'Two doses.' }], referenceIndex: [], sectionIndex: [] });
 * // [{ check: 'missing-parent', reference: 'measles', section: 'doses', detail: 'parent schedule not found' }]
 */
export function missingParents({ sections }: Library): Finding[] {
  const ids = new Set(sections.map((s) => key(s.reference, s.section)));
  return sections
    .filter((s) => s.parent !== null && !ids.has(key(s.reference, s.parent)))
    .map((s) => finding('missing-parent', s, `parent ${s.parent} not found`));
}

/**
 * Finds sections with no text and no subsections. An empty section that has subsections is fine.
 *
 * @param library `Library`. The library's rows, as `auditLibrary` loads them.
 * @returns `Finding[]`. One finding per problem, or none.
 *
 * @example
 * deadEnds({ references: [], sections: [{ reference: 'measles', section: 'schedule', parent: null, title: 'T', text: '' }, { reference: 'measles', section: 'doses', parent: 'schedule', title: 'T', text: 'Two doses.' }, { reference: 'measles', section: 'notes', parent: null, title: 'T', text: '' }], referenceIndex: [], sectionIndex: [] });
 * // [{ check: 'dead-end', reference: 'measles', section: 'notes', detail: 'no text and no subsections' }]
 */
export function deadEnds({ sections }: Library): Finding[] {
  const parents = new Set(
    sections.flatMap((s) => (s.parent ? [key(s.reference, s.parent)] : [])),
  );
  return sections
    .filter(
      (s) => s.text.trim() === '' && !parents.has(key(s.reference, s.section)),
    )
    .map((s) => finding('dead-end', s, 'no text and no subsections'));
}

/**
 * Finds sections whose text is only links, with no letters outside them.
 *
 * @param library `Library`. The library's rows, as `auditLibrary` loads them.
 * @returns `Finding[]`. One finding per problem, or none.
 *
 * @example
 * linksOnly({ references: [], sections: [{ reference: 'measles', section: 'more', parent: null, title: 'T', text: '[CDC](https://www.cdc.gov) [WHO](https://www.who.int)' }], referenceIndex: [], sectionIndex: [] });
 * // [{ check: 'links-only', reference: 'measles', section: 'more', detail: 'text is only links' }]
 */
export function linksOnly({ sections }: Library): Finding[] {
  return sections
    .filter(
      (s) => s.text.trim() !== '' && !/\p{L}/u.test(s.text.replace(LINK, '')),
    )
    .map((s) => finding('links-only', s, 'text is only links'));
}

/**
 * Finds HTML tags left in section text. Escaped text such as `\<b>` is not a tag.
 *
 * @param library `Library`. The library's rows, as `auditLibrary` loads them.
 * @returns `Finding[]`. One finding per problem, or none.
 *
 * @example
 * htmlTags({ references: [], sections: [{ reference: 'measles', section: 'doses', parent: null, title: 'T', text: 'Two <b>doses</b>.<br>' }], referenceIndex: [], sectionIndex: [] });
 * // [{ check: 'html-tags', reference: 'measles', section: 'doses', detail: '<b> <br>' }]
 */
export function htmlTags({ sections }: Library): Finding[] {
  return sections.flatMap((s) => {
    const tags = [
      ...new Set(
        [...s.text.matchAll(HTML_TAG)].map((m) => `<${m[1].toLowerCase()}>`),
      ),
    ].sort();
    return tags.length > 0 ? [finding('html-tags', s, tags.join(' '))] : [];
  });
}

/**
 * Finds links, images and autolinks whose address is not safe (see `isSafeUrl`). Escaped text that only looks like a link is ignored.
 *
 * @param library `Library`. The library's rows, as `auditLibrary` loads them.
 * @returns `Finding[]`. One finding per problem, or none.
 *
 * @example
 * unsafeLinks({ references: [], sections: [{ reference: 'measles', section: 'doses', parent: null, title: 'T', text: '[print](javascript:print()) [CDC](https://www.cdc.gov)' }], referenceIndex: [], sectionIndex: [] });
 * // [{ check: 'unsafe-link', reference: 'measles', section: 'doses', detail: 'links to javascript:' }]
 */
export function unsafeLinks({ sections }: Library): Finding[] {
  return sections.flatMap((s) => {
    const schemes = [
      ...new Set(
        [...s.text.matchAll(LINK_TARGET)]
          .map((m) => m[1] ?? m[2])
          .filter((target) => !isSafeUrl(target))
          .map((target) => `${target.slice(0, target.indexOf(':'))}:`),
      ),
    ].sort();
    return schemes.length > 0
      ? [finding('unsafe-link', s, `links to ${schemes.join(', ')}`)]
      : [];
  });
}

/**
 * Finds sections with the Unicode replacement character, a sign of text that did not decode.
 *
 * @param library `Library`. The library's rows, as `auditLibrary` loads them.
 * @returns `Finding[]`. One finding per problem, or none.
 *
 * @example
 * replacementCharacters({ references: [], sections: [{ reference: 'measles', section: 'doses', parent: null, title: 'T', text: 'Two doses \ufffd apart.' }], referenceIndex: [], sectionIndex: [] });
 * // [{ check: 'replacement-character', reference: 'measles', section: 'doses', detail: 'text has \ufffd' }]
 */
export function replacementCharacters({ sections }: Library): Finding[] {
  return sections
    .filter((s) => s.text.includes('\ufffd'))
    .map((s) => finding('replacement-character', s, 'text has \ufffd'));
}

/**
 * Finds sections whose text repeats an earlier section, in any reference. Empty sections are skipped.
 *
 * @param library `Library`. The library's rows, as `auditLibrary` loads them.
 * @returns `Finding[]`. One finding per problem, or none.
 *
 * @example
 * duplicateText({ references: [], sections: [{ reference: 'measles', section: 'doses', parent: null, title: 'T', text: 'Two doses.' }, { reference: 'measles', section: 'schedule', parent: null, title: 'T', text: 'Two doses.' }], referenceIndex: [], sectionIndex: [] });
 * // [{ check: 'duplicate-text', reference: 'measles', section: 'schedule', detail: 'same text as measles/doses' }]
 */
export function duplicateText({ sections }: Library): Finding[] {
  const first = new Map<string, SectionRow>();
  return sections.flatMap((s) => {
    const text = s.text.trim();
    if (text === '') {
      return [];
    }
    const earlier = first.get(text);
    if (!earlier) {
      first.set(text, s);
      return [];
    }
    return [
      finding(
        'duplicate-text',
        s,
        `same text as ${key(earlier.reference, earlier.section)}`,
      ),
    ];
  });
}

/**
 * Finds references with under 500 characters of section text in all.
 *
 * @param library `Library`. The library's rows, as `auditLibrary` loads them.
 * @returns `Finding[]`. One finding per problem, or none.
 *
 * @example
 * shortReferences({ references: [{ id: 'measles', title: 'Measles', summary: 'Vaccine schedule' }], sections: [{ reference: 'measles', section: 'doses', parent: null, title: 'T', text: 'Two doses.' }], referenceIndex: [], sectionIndex: [] });
 * // [{ check: 'short-reference', reference: 'measles', section: null, detail: '10 characters of text' }]
 */
export function shortReferences({ references, sections }: Library): Finding[] {
  return references.flatMap(({ id }) => {
    const chars = sections
      .filter((s) => s.reference === id)
      .reduce((sum, s) => sum + s.text.trim().length, 0);
    return chars < SHORT_REFERENCE_CHARS
      ? [
          {
            check: 'short-reference' as const,
            reference: id,
            section: null,
            detail: `${chars} characters of text`,
          },
        ]
      : [];
  });
}

/**
 * Finds a library with no references.
 *
 * @param library `Library`. The library's rows, as `auditLibrary` loads them.
 * @returns `Finding[]`. One finding per problem, or none.
 *
 * @example
 * emptyLibrary({ references: [], sections: [], referenceIndex: [], sectionIndex: [] });
 * // [{ check: 'empty-library', reference: '(library)', section: null, detail: 'no references' }]
 */
export function emptyLibrary({ references }: Library): Finding[] {
  return references.length === 0
    ? [
        {
          check: 'empty-library',
          reference: '(library)',
          section: null,
          detail: 'no references',
        },
      ]
    : [];
}

function repeated<T>(
  rows: T[],
  keyOf: (row: T) => string,
): { row: T; times: number }[] {
  const counts = new Map<string, { row: T; times: number }>();
  for (const row of rows) {
    const seen = counts.get(keyOf(row));
    if (seen) {
      seen.times += 1;
    } else {
      counts.set(keyOf(row), { row, times: 1 });
    }
  }
  return [...counts.values()].filter(({ times }) => times > 1);
}

/**
 * Finds references and sections that are missing from their search table, indexed with other text, indexed more than once, or left in it after deletion.
 *
 * @param library `Library`. The library's rows, as `auditLibrary` loads them.
 * @returns `Finding[]`. One finding per problem, or none.
 *
 * @example
 * searchIndex({
 *   references: [{ id: 'measles', title: 'Measles', summary: 'Vaccine schedule' }],
 *   sections: [{ reference: 'measles', section: 'doses', parent: null, title: 'T', text: 'Two doses.' }],
 *   referenceIndex: [{ id: 'measles', title: 'Measles', summary: 'Vaccine schedule' }],
 *   sectionIndex: [],
 * });
 * // [{ check: 'search-index', reference: 'measles', section: 'doses', detail: 'missing from the section search index or indexed with other text' }]
 */
export function searchIndex({
  references,
  sections,
  referenceIndex,
  sectionIndex,
}: Library): Finding[] {
  const referenceKey = (r: ReferenceRow) =>
    JSON.stringify([r.id, r.title, r.summary]);
  const sectionKey = (s: SectionRow) =>
    JSON.stringify([s.reference, s.section, s.title, s.text]);
  const indexedReferences = new Set(referenceIndex.map(referenceKey));
  const referenceIds = new Set(references.map((r) => r.id));
  const indexedSections = new Set(sectionIndex.map(sectionKey));
  const sectionIds = new Set(sections.map((s) => key(s.reference, s.section)));
  const searchFinding = (
    reference: string,
    section: string | null,
    detail: string,
  ): Finding => ({ check: 'search-index', reference, section, detail });
  return [
    ...repeated(referenceIndex, (r) => r.id).map(({ row, times }) =>
      searchFinding(row.id, null, `indexed ${times} times`),
    ),
    ...repeated(sectionIndex, (s) => key(s.reference, s.section)).map(
      ({ row, times }) =>
        searchFinding(row.reference, row.section, `indexed ${times} times`),
    ),
    ...references
      .filter((r) => !indexedReferences.has(referenceKey(r)))
      .map((r) =>
        searchFinding(
          r.id,
          null,
          'missing from the reference search index or indexed with another title or summary',
        ),
      ),
    ...referenceIndex
      .filter((r) => !referenceIds.has(r.id))
      .map((r) =>
        searchFinding(
          r.id,
          null,
          'in the reference search index but not in the library',
        ),
      ),
    ...sections
      .filter((s) => !indexedSections.has(sectionKey(s)))
      .map((s) =>
        searchFinding(
          s.reference,
          s.section,
          'missing from the section search index or indexed with other text',
        ),
      ),
    ...sectionIndex
      .filter((s) => !sectionIds.has(key(s.reference, s.section)))
      .map((s) =>
        searchFinding(
          s.reference,
          s.section,
          'in the section search index but not in the library',
        ),
      ),
  ];
}

const CHECKS: Check[] = [
  missingParents,
  deadEnds,
  linksOnly,
  htmlTags,
  unsafeLinks,
  replacementCharacters,
  duplicateText,
  shortReferences,
  emptyLibrary,
  searchIndex,
];
