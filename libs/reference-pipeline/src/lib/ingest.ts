import { renameSync, rmSync } from 'fs';

import { fetchCdcMediaPage } from './cdcMedia';
import { htmlToBlocks } from './htmlToBlocks';
import { pdfToBlocks } from './pdfBlocks';
import { openReferencesDb, writeReference } from './referencesDb';
import { Block, Chunk, Section, blocksToDocument } from './sections';
import { Source } from './sources';

/**
 * What happened to one source in sources.json.
 *
 * `empty` means the source has no text besides its headings.
 * `buildReferenceLibrary` does not store it.
 *
 * @example
 * { id: 'uspstf-a-and-b', status: 'written', sections: 12 }
 */
export type IngestReport =
  | {
      id: string;
      status: 'written';
      sections: number;
    }
  | { id: string; status: 'empty' };

/**
 * Builds the reference library from the sources in sources.json. This is the
 * function the CLI runs.
 *
 * It fetches and converts every source before it writes any of them. If any
 * step throws, the promise rejects and `path` keeps the old library. A reader
 * of `path` never sees a partial library.
 *
 * @param args.path `string`. Where the library file goes.
 * @param args.sources `Source[]`. From `parseSources`.
 * @param args.fetchBytes `(url: string) => Promise<Uint8Array>`. From
 * `createRateLimitedFetch`.
 * @returns `Promise<IngestReport[]>`. One {@link IngestReport} per source, in
 * the same order as `sources`.
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
 * //     sections: 12,
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
    markdown: string;
    sections: Section[];
    chunks: Chunk[];
  }[] = [];
  for (const source of sources) {
    const { url, blocks } = await fetchSourceAsBlocks(source, fetchBytes);
    parsed.push({ source, url, ...blocksToDocument(blocks) });
  }

  const building = `${path}.building`;
  rmSync(building, { force: true });
  const db = openReferencesDb(building);
  const reports = parsed.map(
    ({ source, url, markdown, sections, chunks }): IngestReport => {
      if (chunks.length === 0) {
        return { id: source.id, status: 'empty' };
      }
      writeReference(db, {
        id: source.id,
        title: source.title,
        edition: source.edition,
        summary: source.summary,
        url,
        markdown,
        sections,
        chunks,
      });
      return {
        id: source.id,
        status: 'written',
        sections: sections.length,
      };
    },
  );
  db.close();
  renameSync(building, path);
  return reports;
}

type Fetched = { url: string; blocks: Block[] };

async function fetchSourceAsBlocks(
  source: Source,
  fetchBytes: (url: string) => Promise<Uint8Array>,
): Promise<Fetched> {
  switch (source.type) {
    case 'pdf': {
      const pdf = await fetchBytes(source.url);
      return { url: source.url, blocks: await pdfToBlocks(pdf) };
    }
    case 'html':
      return {
        url: source.url,
        blocks: htmlBytesToBlocks(await fetchBytes(source.url)),
      };
    case 'cdc-media': {
      const { url, html } = await fetchCdcMediaPage(source.mediaId, fetchBytes);
      return { url, blocks: htmlToBlocks(html) };
    }
  }
}

function htmlBytesToBlocks(bytes: Uint8Array): Block[] {
  return htmlToBlocks(new TextDecoder().decode(bytes));
}
