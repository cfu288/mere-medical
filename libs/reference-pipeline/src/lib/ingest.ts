import { renameSync, rmSync } from 'fs';

import { fetchCdcMediaPage } from './cdcMedia';
import { htmlToBlocks } from './htmlToBlocks';
import { pdfToBlocks } from './pdfBlocks';
import { openReferencesDb, writeReference } from './referencesDb';
import { Block, Part, Section, blocksToDocument } from './sections';
import { Source } from './sources';

/**
 * What happened to one configured source, for the CLI to print.
 *
 * - `id`: the source's configured id.
 * - `status`: `written` when the library holds it, or `empty` when it parsed to
 *   no text and the library holds nothing for it.
 * - `sections`: for a written source, how many sections it has.
 *
 * @example
 * { id: 'uspstf-a-and-b', status: 'written', sections: 3 }
 */
export type IngestReport =
  | {
      id: string;
      status: 'written';
      sections: number;
    }
  | { id: string; status: 'empty' };

/**
 * Builds a new reference library at `path` from the configured `sources`.
 *
 * It fetches and parses every source first. A failed fetch or a malformed
 * response rejects the promise and leaves any library at `path` as it was. It
 * then writes the library to `<path>.building` and renames it over `path`. A
 * reader of `path` sees the old library or the new one, never a partial one. It
 * reports a source that parsed to no text as `empty` and does not store it.
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
    parts: Part[];
  }[] = [];
  for (const source of sources) {
    const { url, blocks } = await fetchSourceAsBlocks(source, fetchBytes);
    parsed.push({ source, url, ...blocksToDocument(blocks) });
  }

  const building = `${path}.building`;
  rmSync(building, { force: true });
  const db = openReferencesDb(building);
  const reports = parsed.map(
    ({ source, url, markdown, sections, parts }): IngestReport => {
      if (parts.length === 0) {
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
        parts,
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
