import { DatabaseSync } from 'node:sqlite';
import { z } from 'zod';

import { linesToBlocks, pdfLines } from './pdfBlocks';
import {
  ReferenceRecord,
  deleteReferencesExcept,
  writeReference,
} from './referencesDb';
import { Block, Section, buildSections } from './sections';
import { Source } from './sources';
import { htmlToBlocks } from './htmlToBlocks';

/**
 * What happened to one configured source, for the CLI to print.
 *
 * - `id`: the source's configured id.
 * - `status`: `written` when its sections replaced the stored copy,
 *   `unchanged` when it parsed to no sections and the stored copy stays,
 *   `missing` when it parsed to no sections and nothing was stored, or
 *   `skipped` when an earlier source already resolved to the same url.
 * - `outline`: for a written source, every kept section in document order,
 *   with its nesting depth (0 for a top-level section), id, title and
 *   markdown length in characters.
 * - `dropped`: for a source that was not skipped, titles of sections left out
 *   by rule, such as reference lists and appendices. Empty when nothing was
 *   dropped.
 * - `url`: for a skipped source, the url the earlier source already used.
 *
 * @example
 * {
 *   id: 'uspstf-a-and-b',
 *   status: 'written',
 *   outline: [
 *     { depth: 0, sectionId: 'screening', title: 'Screening', chars: 14 },
 *     { depth: 1, sectionId: 'hypertension', title: 'Hypertension', chars: 23 },
 *   ],
 *   dropped: ['References'],
 * }
 */
export type IngestReport =
  | {
      id: string;
      status: 'written';
      outline: {
        depth: number;
        sectionId: string;
        title: string;
        chars: number;
      }[];
      dropped: string[];
    }
  | { id: string; status: 'unchanged' | 'missing'; dropped: string[] }
  | { id: string; status: 'skipped'; url: string };

/**
 * Rebuilds the reference library in `db` so it holds exactly the configured
 * `sources`.
 *
 * Every source is fetched and parsed before anything is written. A failed
 * fetch or a malformed response rejects the promise and leaves the library
 * as it was. The write then runs in one transaction.
 *
 * - A stored reference whose id is no longer configured is deleted.
 * - A source that parsed to at least one section replaces its stored copy.
 * - A source that parsed to no sections keeps its stored copy, if any.
 * - A source that resolves to a url an earlier source already used is not
 *   stored and is reported as `skipped`.
 *
 * @param args.db A library opened with `openReferencesDb`.
 * @param args.sources Parsed configuration, from `parseSources`.
 * @param args.fetchBytes Returns the body at a url, and throws when it cannot.
 * @returns `Promise<IngestReport[]>`. One {@link IngestReport} per source, in
 * configuration order.
 *
 * @example
 * const report = await ingestSources({
 *   db: openReferencesDb('references.db'),
 *   sources: parseSources([
 *     {
 *       id: 'uspstf-a-and-b',
 *       type: 'html',
 *       url: 'https://example.com/ab',
 *       title: 'USPSTF A and B Recommendations',
 *       edition: 'Updated continuously',
 *       summary: 'Screening and prevention',
 *     },
 *   ]),
 *   fetchBytes: async (url) => {
 *     const response = await fetch(url);
 *     if (!response.ok) {
 *       throw new Error(`GET ${url} returned ${response.status}`);
 *     }
 *     return new Uint8Array(await response.arrayBuffer());
 *   },
 * });
 * // [
 * //   {
 * //     id: 'uspstf-a-and-b',
 * //     status: 'written',
 * //     outline: [...],
 * //     dropped: ['References'],
 * //   },
 * // ]
 */
export async function ingestSources({
  db,
  sources,
  fetchBytes,
}: {
  db: DatabaseSync;
  sources: Source[];
  fetchBytes: (url: string) => Promise<Uint8Array>;
}): Promise<IngestReport[]> {
  const results: Parsed[] = [];
  const ingestedUrls = new Set<string>();
  for (const source of sources) {
    const result = await fetchDocument(source, fetchBytes);
    if (ingestedUrls.has(result.url)) {
      results.push({ kind: 'skipped', id: source.id, url: result.url });
      continue;
    }
    ingestedUrls.add(result.url);
    const { sections, dropped } = buildSections(result.blocks);
    results.push({
      kind: 'parsed',
      record: {
        id: source.id,
        title: source.title,
        edition: source.edition,
        summary: source.summary,
        url: result.url,
        sections,
      },
      dropped,
    });
  }

  db.exec('BEGIN');
  try {
    deleteReferencesExcept(
      db,
      results.flatMap((r) => (r.kind === 'parsed' ? [r.record.id] : [])),
    );
    const reports = results.map(
      (result): IngestReport =>
        result.kind === 'skipped'
          ? { id: result.id, status: 'skipped', url: result.url }
          : store(db, result.record, result.dropped),
    );
    db.exec('COMMIT');
    return reports;
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}

function htmlBlocks(bytes: Uint8Array): Block[] {
  return htmlToBlocks(new TextDecoder().decode(bytes));
}

type Parsed =
  | { kind: 'skipped'; id: string; url: string }
  | { kind: 'parsed'; record: ReferenceRecord; dropped: string[] };

function store(
  db: DatabaseSync,
  record: ReferenceRecord,
  dropped: string[],
): IngestReport {
  if (record.sections.length === 0) {
    const stored = db
      .prepare('SELECT 1 FROM documents WHERE id = ?')
      .get(record.id);
    return { id: record.id, status: stored ? 'unchanged' : 'missing', dropped };
  }
  writeReference(db, record);
  return {
    id: record.id,
    status: 'written',
    outline: outline(record.sections),
    dropped,
  };
}

// Serves a cdc.gov page's content without the site navigation.
const CDC_MEDIA_API = 'https://tools.cdc.gov/api/v2/resources/media';

const cdcMediaSchema = z.object({
  results: z
    .tuple([z.object({ sourceUrl: z.string().url() })])
    .rest(z.unknown()),
});

type Fetched = { url: string; blocks: Block[] };

async function fetchDocument(
  source: Source,
  fetchBytes: (url: string) => Promise<Uint8Array>,
): Promise<Fetched> {
  switch (source.type) {
    case 'pdf':
      return {
        url: source.url,
        blocks: linesToBlocks(await pdfLines(await fetchBytes(source.url))),
      };
    case 'html':
      return {
        url: source.url,
        blocks: htmlBlocks(await fetchBytes(source.url)),
      };
    case 'cdc-media': {
      const metadata = await fetchBytes(
        `${CDC_MEDIA_API}/${source.mediaId}.json`,
      );
      const url = cdcMediaSchema.parse(
        JSON.parse(new TextDecoder().decode(metadata)),
      ).results[0].sourceUrl;
      return {
        url,
        blocks: htmlBlocks(
          await fetchBytes(`${CDC_MEDIA_API}/${source.mediaId}/content.html`),
        ),
      };
    }
  }
}

function outline(
  sections: Section[],
): { depth: number; sectionId: string; title: string; chars: number }[] {
  const depthOf = new Map<string, number>();
  return sections.map((section) => {
    const depth =
      section.parentId === null ? 0 : (depthOf.get(section.parentId) ?? 0) + 1;
    depthOf.set(section.sectionId, depth);
    return {
      depth,
      sectionId: section.sectionId,
      title: section.title,
      chars: section.contentMd.length,
    };
  });
}
