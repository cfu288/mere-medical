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
 * Every row the checks read, loaded once by `auditLibrary`. Each check is a
 * pure function of this object, and a test passes literal rows with no
 * database.
 *
 * - `references`: the `documents` rows, ordered by id.
 * - `sections`: the `sections` rows, ordered by reference and then position.
 *   This is reading order, and "earlier" in `duplicateText` means earlier in
 *   it.
 */
export type Library = {
  references: ReferenceRow[];
  sections: SectionRow[];
};

type Check = (library: Library) => Finding[];

const SHORT_REFERENCE_CHARS = 500;
const LINK = /!?\[[^\]]*\]\([^)]*\)/g;
const LINK_TARGET =
  /(?<!\\)!?\[[^\]]*\]\(\s*([^\s)]+)|(?<!\\)<([a-z][a-z0-9+.-]*:[^>\s]*)>/gi;
const HTML_TAG = /(?<!\\)<\/?([a-z][a-z0-9]*)\b[^>]*>/gi;

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
];

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
  return [...CHECKS.flatMap((check) => check(library)), ...searchIndex(db)];
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

const SEARCH_INDEX_PROBLEMS = [
  `SELECT id AS reference, NULL AS section, 'indexed ' || count(*) || ' times' AS detail
   FROM documents_fts GROUP BY id HAVING count(*) > 1 ORDER BY min(rowid)`,
  `SELECT document_id AS reference, section_id AS section, 'indexed ' || count(*) || ' times' AS detail
   FROM sections_fts GROUP BY document_id, section_id HAVING count(*) > 1 ORDER BY min(rowid)`,
  `SELECT id AS reference, NULL AS section,
          'missing from the reference search index or indexed with another title or summary' AS detail
   FROM (SELECT id, title, summary FROM documents EXCEPT SELECT id, title, summary FROM documents_fts)
   ORDER BY id`,
  `SELECT id AS reference, NULL AS section, 'in the reference search index but not in the library' AS detail
   FROM documents_fts WHERE id NOT IN (SELECT id FROM documents) ORDER BY rowid`,
  `SELECT s.document_id AS reference, s.section_id AS section,
          'missing from the section search index or indexed with other text' AS detail
   FROM sections s
   JOIN (SELECT document_id, section_id, title, content_md FROM sections
         EXCEPT SELECT document_id, section_id, title, content_md FROM sections_fts) m
     USING (document_id, section_id)
   ORDER BY s.document_id, s.position`,
  `SELECT document_id AS reference, section_id AS section,
          'in the section search index but not in the library' AS detail
   FROM sections_fts WHERE (document_id, section_id) NOT IN (SELECT document_id, section_id FROM sections)
   ORDER BY rowid`,
];

/**
 * Finds references and sections that are missing from their search table,
 * indexed with other text, indexed more than once, or left in it after
 * deletion. The search tables have no triggers. `writeReference` and
 * `deleteReference` fill and clear them next to the rows.
 *
 * @param db `DatabaseSync`. From `openReferencesDb`.
 * @returns `Finding[]`. One finding per problem, or none.
 *
 * @example
 * // The library holds 'measles' with section 'doses', and the section search table lost that row.
 * searchIndex(db);
 * // [{ check: 'search-index', reference: 'measles', section: 'doses', detail: 'missing from the section search index or indexed with other text' }]
 */
export function searchIndex(db: DatabaseSync): Finding[] {
  return SEARCH_INDEX_PROBLEMS.flatMap((sql) =>
    (
      db.prepare(sql).all() as {
        reference: string;
        section: string | null;
        detail: string;
      }[]
    ).map((row) => ({ check: 'search-index' as const, ...row })),
  );
}
