import { renameSync, rmSync } from 'fs';
import { z } from 'zod';

import { htmlToBlocks } from './htmlToBlocks';
import { pdfLinesToBlocks, readPdfLines } from './pdfBlocks';
import { openReferencesDb, writeReference } from './referencesDb';
import { Block, Section, groupBlocksIntoSections } from './sections';
import { Source } from './sources';

/**
 * What happened to one configured source, for the CLI to print.
 *
 * - `id`: the source's configured id.
 * - `status`: `written` when the library holds its sections, or `empty` when it
 *   parsed to no sections and the library holds nothing for it.
 * - `outline`: for a written source, every kept section in document order.
 *   Each entry holds the section's nesting depth (0 for a top-level section),
 *   id, title and markdown length in characters.
 *
 * @example
 * {
 *   id: 'uspstf-a-and-b',
 *   status: 'written',
 *   outline: [
 *     { depth: 0, sectionId: 'screening', title: 'Screening', chars: 14 },
 *     { depth: 1, sectionId: 'hypertension', title: 'Hypertension', chars: 23 },
 *   ],
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
    }
  | { id: string; status: 'empty' };

/**
 * Builds a new reference library at `path` from the configured `sources`.
 *
 * It fetches and parses every source first. A failed fetch or a malformed
 * response rejects the promise and leaves any library at `path` as it was. It
 * then writes the library to `<path>.building` and renames it over `path`. A
 * reader of `path` sees the old library or the new one, never a partial one. It
 * reports a source that parsed to no sections as `empty` and does not store it.
 *
 * @param args.path `string`. Where the library file goes.
 * @param args.sources `Source[]`. Parsed configuration, from `parseSources`.
 * @param args.fetchBytes `(url: string) => Promise<Uint8Array>`. Returns the
 * body at a url, and throws when it cannot.
 * @returns `Promise<IngestReport[]>`. One {@link IngestReport} per source, in
 * configuration order.
 *
 * @example
 * const report = await buildReferenceLibrary({
 *   path: 'libs/reference-pipeline/data/references.db',
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
 *   fetchBytes: createRateLimitedFetch(),
 * });
 * // [
 * //   {
 * //     id: 'uspstf-a-and-b',
 * //     status: 'written',
 * //     outline: [...],
 * //   },
 * // ]
 */
export async function buildReferenceLibrary({
  path,
  sources,
  fetchBytes,
}: {
  path: string;
  sources: Source[];
  fetchBytes: (url: string) => Promise<Uint8Array>;
}): Promise<IngestReport[]> {
  const parsed: {
    source: Source;
    url: string;
    sections: Section[];
  }[] = [];
  for (const source of sources) {
    const { url, blocks } = await fetchSourceAsBlocks(source, fetchBytes);
    parsed.push({ source, url, sections: groupBlocksIntoSections(blocks) });
  }

  const building = `${path}.building`;
  rmSync(building, { force: true });
  const db = openReferencesDb(building);
  db.exec('BEGIN');
  const reports = parsed.map(({ source, url, sections }): IngestReport => {
    if (sections.length === 0) {
      return { id: source.id, status: 'empty' };
    }
    writeReference(db, {
      id: source.id,
      title: source.title,
      edition: source.edition,
      summary: source.summary,
      url,
      sections,
    });
    return {
      id: source.id,
      status: 'written',
      outline: outlineWithDepth(sections),
    };
  });
  db.exec('COMMIT');
  db.close();
  renameSync(building, path);
  return reports;
}

// Serves a cdc.gov page's content without the site navigation.
const CDC_MEDIA_API = 'https://tools.cdc.gov/api/v2/resources/media';

const cdcMediaSchema = z.object({
  results: z
    .tuple([z.object({ sourceUrl: z.string().url() })])
    .rest(z.unknown()),
});

type Fetched = { url: string; blocks: Block[] };

async function fetchSourceAsBlocks(
  source: Source,
  fetchBytes: (url: string) => Promise<Uint8Array>,
): Promise<Fetched> {
  switch (source.type) {
    case 'pdf':
      return {
        url: source.url,
        blocks: pdfLinesToBlocks(
          await readPdfLines(await fetchBytes(source.url)),
        ),
      };
    case 'html':
      return {
        url: source.url,
        blocks: htmlBytesToBlocks(await fetchBytes(source.url)),
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
        blocks: htmlBytesToBlocks(
          await fetchBytes(`${CDC_MEDIA_API}/${source.mediaId}/content.html`),
        ),
      };
    }
  }
}

function htmlBytesToBlocks(bytes: Uint8Array): Block[] {
  return htmlToBlocks(new TextDecoder().decode(bytes));
}

function outlineWithDepth(
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
