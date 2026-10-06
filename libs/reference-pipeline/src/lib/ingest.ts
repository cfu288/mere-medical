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

export type IngestReport = {
  id: string;
  outline: { depth: number; sectionId: string; title: string; chars: number }[];
  dropped: string[];
};

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
