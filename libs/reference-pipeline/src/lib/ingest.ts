import { DatabaseSync } from 'node:sqlite';
import { z } from 'zod';

import { drugLabel } from './drugLabel';
import { linesToBlocks, pdfLines } from './pdfBlocks';
import {
  ReferenceRecord,
  deleteReference,
  deleteReferencesExcept,
  writeReference,
} from './referencesDb';
import {
  ParsedDocument,
  Section,
  Spoke,
  buildSections,
  buildSpokeSections,
} from './sections';
import { Source } from './sources';
import { fetchJson, webpage } from './webpage';

/**
 * What one configured reference parsed into, for the CLI to print.
 *
 * - `id`: the source's configured id.
 * - `outline`: every kept section in document order, with its nesting depth
 *   (0 for a top-level section), id, title and markdown length in characters.
 * - `dropped`: titles of sections left out by rule, such as reference lists
 *   and appendices. Empty when nothing was dropped.
 *
 * @example
 * {
 *   id: 'uspstf-a-and-b',
 *   outline: [
 *     { depth: 0, sectionId: 'screening', title: 'Screening', chars: 14 },
 *     { depth: 1, sectionId: 'hypertension', title: 'Hypertension', chars: 23 },
 *   ],
 *   dropped: ['References'],
 * }
 */
export type IngestReport = {
  id: string;
  outline: { depth: number; sectionId: string; title: string; chars: number }[];
  dropped: string[];
};

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
 * - A source that parsed to no sections keeps its stored copy and is listed
 *   in `unchanged`, or is listed in `missing` when nothing was stored.
 * - A source that resolves to a url an earlier source already used is not
 *   stored and is listed in `skipped`.
 *
 * @param args.db A library opened with `openReferencesDb`.
 * @param args.sources Parsed configuration, from `parseSources`.
 * @param args.fetchBytes Returns the body at a url, and throws when it cannot.
 * @returns
 * - `references`: one {@link IngestReport} per source that was not skipped,
 *   in configuration order.
 * - `skipped`: the id of each skipped source and the url it shared.
 * - `unchanged`: ids kept as they were stored.
 * - `missing`: ids that could not be added.
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
 *     { id: 'label-estradiol', type: 'drug-label', generic: 'estradiol' },
 *   ]),
 *   fetchBytes: async (url) => {
 *     const response = await fetch(url);
 *     if (!response.ok) {
 *       throw new Error(`GET ${url} returned ${response.status}`);
 *     }
 *     return new Uint8Array(await response.arrayBuffer());
 *   },
 * });
 * // {
 * //   references: [
 * //     { id: 'uspstf-a-and-b', outline: [...], dropped: ['References'] },
 * //     { id: 'label-estradiol', outline: [...], dropped: [] },
 * //   ],
 * //   skipped: [],
 * //   unchanged: [],
 * //   missing: [],
 * // }
 */
export async function ingestSources({
  db,
  sources,
  fetchBytes,
}: {
  db: DatabaseSync;
  sources: Source[];
  fetchBytes: (url: string) => Promise<Uint8Array>;
}): Promise<{
  references: IngestReport[];
  skipped: Skipped[];
  unchanged: string[];
  missing: string[];
}> {
  const parsed: { record: ReferenceRecord; dropped: string[] }[] = [];
  const skipped: Skipped[] = [];
  const ingestedUrls = new Set<string>();
  for (const source of sources) {
    const result = await fetchDocument(source, fetchBytes);
    if (ingestedUrls.has(result.url)) {
      skipped.push({ id: source.id, url: result.url });
      continue;
    }
    ingestedUrls.add(result.url);
    const { sections, dropped } =
      'spokes' in result
        ? buildSpokeSections(result.spokes)
        : buildSections(result.document);
    parsed.push({
      record: {
        id: source.id,
        title: result.title,
        edition: result.edition,
        summary: result.summary,
        url: result.url,
        sections,
      },
      dropped,
    });
  }

  const unchanged: string[] = [];
  const missing: string[] = [];
  const stored = db.prepare('SELECT 1 FROM documents WHERE id = ?');
  db.exec('BEGIN');
  try {
    deleteReferencesExcept(
      db,
      parsed.map(({ record }) => record.id),
    );
    for (const { record } of parsed) {
      if (record.sections.length === 0) {
        (stored.get(record.id) ? unchanged : missing).push(record.id);
        continue;
      }
      deleteReference(db, record.id);
      writeReference(db, record);
    }
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }

  return {
    references: parsed.map(({ record, dropped }) => ({
      id: record.id,
      outline: outline(record.sections),
      dropped,
    })),
    skipped,
    unchanged,
    missing,
  };
}

const CDC_MEDIA_API = 'https://tools.cdc.gov/api/v2/resources/media';

const cdcMediaSchema = z.object({
  results: z
    .tuple([z.object({ sourceUrl: z.string().url() })])
    .rest(z.unknown()),
});

type Fetched = {
  title: string;
  edition: string;
  summary: string;
  url: string;
} & ({ document: ParsedDocument } | { spokes: Spoke[] });

async function fetchDocument(
  source: Source,
  fetchBytes: (url: string) => Promise<Uint8Array>,
): Promise<Fetched> {
  switch (source.type) {
    case 'pdf':
      return {
        ...described(source),
        url: source.url,
        document: {
          kind: 'paged',
          blocks: linesToBlocks(await pdfLines(await fetchBytes(source.url))),
        },
      };
    case 'html':
      return {
        ...described(source),
        url: source.url,
        document: webpage(await fetchBytes(source.url)),
      };
    case 'cdc-media': {
      const url = cdcMediaSchema.parse(
        await fetchJson(`${CDC_MEDIA_API}/${source.mediaId}.json`, fetchBytes),
      ).results[0].sourceUrl;
      return {
        ...described(source),
        url,
        document: webpage(
          await fetchBytes(`${CDC_MEDIA_API}/${source.mediaId}/content.html`),
        ),
      };
    }
    case 'drug-label':
      return drugLabel(source.generic, fetchBytes);
  }
}

type Skipped = { id: string; url: string };

function described(source: {
  title: string;
  edition: string;
  summary: string;
}) {
  return {
    title: source.title,
    edition: source.edition,
    summary: source.summary,
  };
}

function outline(sections: Section[]): IngestReport['outline'] {
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
