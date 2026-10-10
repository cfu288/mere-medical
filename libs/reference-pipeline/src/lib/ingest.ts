import { DatabaseSync } from 'node:sqlite';
import { z } from 'zod';

import { linesToBlocks, pdfLines } from './pdfBlocks';
import {
  ReferenceRecord,
  deleteReference,
  deleteReferencesExcept,
  writeReference,
} from './referencesDb';
import { ParsedDocument, Section, buildSections } from './sections';
import { Source } from './sources';
import { webpage } from './webpage';

/**
 * What one configured reference parsed into, for the CLI to print.
 *
 * - `id`: the source's configured id.
 * - `status`: `written` when its sections replaced the stored copy,
 *   `unchanged` when it parsed to no sections and the stored copy stays, or
 *   `missing` when it parsed to no sections and nothing was stored.
 * - `outline`: every kept section in document order, with its nesting depth
 *   (0 for a top-level section), id, title and markdown length in characters.
 * - `dropped`: titles of sections left out by rule, such as reference lists
 *   and appendices. Empty when nothing was dropped.
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
export type IngestReport = {
  id: string;
  status: 'written' | 'unchanged' | 'missing';
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
 * - A source that parsed to no sections keeps its stored copy, if any.
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
 * // {
 * //   references: [
 * //     {
 * //       id: 'uspstf-a-and-b',
 * //       status: 'written',
 * //       outline: [...],
 * //       dropped: ['References'],
 * //     },
 * //   ],
 * //   skipped: [],
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
}): Promise<{ references: IngestReport[]; skipped: Skipped[] }> {
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
    const { sections, dropped } = buildSections(result.document);
    parsed.push({
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

  const references: IngestReport[] = [];
  const stored = db.prepare('SELECT 1 FROM documents WHERE id = ?');
  db.exec('BEGIN');
  try {
    deleteReferencesExcept(
      db,
      parsed.map(({ record }) => record.id),
    );
    for (const { record, dropped } of parsed) {
      const status =
        record.sections.length > 0
          ? 'written'
          : stored.get(record.id)
            ? 'unchanged'
            : 'missing';
      if (status === 'written') {
        deleteReference(db, record.id);
        writeReference(db, record);
      }
      references.push({
        id: record.id,
        status,
        outline: outline(record.sections),
        dropped,
      });
    }
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }

  return { references, skipped };
}

const CDC_MEDIA_API = 'https://tools.cdc.gov/api/v2/resources/media';

const cdcMediaSchema = z.object({
  results: z
    .tuple([z.object({ sourceUrl: z.string().url() })])
    .rest(z.unknown()),
});

type Fetched = { url: string; document: ParsedDocument };

async function fetchDocument(
  source: Source,
  fetchBytes: (url: string) => Promise<Uint8Array>,
): Promise<Fetched> {
  switch (source.type) {
    case 'pdf':
      return {
        url: source.url,
        document: {
          kind: 'paged',
          blocks: linesToBlocks(await pdfLines(await fetchBytes(source.url))),
        },
      };
    case 'html':
      return {
        url: source.url,
        document: webpage(await fetchBytes(source.url)),
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
        document: webpage(
          await fetchBytes(`${CDC_MEDIA_API}/${source.mediaId}/content.html`),
        ),
      };
    }
  }
}

type Skipped = { id: string; url: string };

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
