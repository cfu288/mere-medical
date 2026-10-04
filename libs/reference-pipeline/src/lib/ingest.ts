import { DatabaseSync } from 'node:sqlite';
import { z } from 'zod';

import { markdownToBlocks } from './blocks';
import { htmlToMarkdown } from './htmlToMarkdown';
import { linesToBlocks, pdfLines } from './pdfBlocks';
import {
  ReferenceRecord,
  deleteReference,
  deleteReferencesExcept,
  writeReference,
} from './referencesDb';
import { ParsedDocument, Section, buildSections } from './sections';
import { Source } from './sources';

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
    const { sections, dropped } = buildSections(result.document);
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
  db.exec('BEGIN');
  try {
    deleteReferencesExcept(
      db,
      parsed.map(({ record }) => record.id),
    );
    for (const { record } of parsed) {
      if (record.sections.length === 0) {
        unchanged.push(record.id);
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
  document: ParsedDocument;
};

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

const OPENFDA_LABELS = 'https://api.fda.gov/drug/label.json';
const RXNAV = 'https://rxnav.nlm.nih.gov/REST';

const labelSearchSchema = z.object({
  results: z
    .tuple([
      z.object({
        set_id: z.string().min(1),
        effective_time: z.string().min(4),
      }),
    ])
    .rest(z.unknown()),
});
const rxcuiSchema = z.object({
  idGroup: z.object({ rxnormId: z.array(z.string()).optional() }),
});
const brandedSchema = z.object({
  relatedGroup: z.object({
    conceptGroup: z
      .array(
        z.object({
          conceptProperties: z.array(z.object({ name: z.string() })).optional(),
        }),
      )
      .optional(),
  }),
});
const classSchema = z.object({
  rxclassDrugInfoList: z
    .object({
      rxclassDrugInfo: z.array(
        z.object({
          rxclassMinConceptItem: z.object({ className: z.string() }),
        }),
      ),
    })
    .optional(),
});

async function drugLabel(
  generic: string,
  fetchBytes: (url: string) => Promise<Uint8Array>,
): Promise<Fetched> {
  const search = `openfda.generic_name.exact:"${generic}" AND openfda.product_type.exact:"HUMAN PRESCRIPTION DRUG"`;
  const label = labelSearchSchema.parse(
    await fetchJson(
      `${OPENFDA_LABELS}?search=${encodeURIComponent(search)}&sort=${encodeURIComponent('effective_time:desc')}&limit=1`,
      fetchBytes,
    ),
  ).results[0];
  const url = `https://dailymed.nlm.nih.gov/dailymed/fda/fdaDrugXsl.cfm?setid=${label.set_id}&type=display`;
  const name = generic.charAt(0) + generic.slice(1).toLowerCase();
  const { brands, classes } = await brandsAndClasses(
    generic.toLowerCase(),
    fetchBytes,
  );
  return {
    title: `FDA drug label: ${name}`,
    edition: label.effective_time.slice(0, 4),
    summary: [
      brands.length > 0 ? `${name} (brands: ${brands.join(', ')})` : name,
      ...(classes.length > 0 ? [classes.join(', ')] : []),
      'FDA prescribing information: uses, dosing, warnings, side effects, interactions',
    ].join('; '),
    url,
    document: webpage(await fetchBytes(url)),
  };
}

async function brandsAndClasses(
  name: string,
  fetchBytes: (url: string) => Promise<Uint8Array>,
): Promise<{ brands: string[]; classes: string[] }> {
  const rxcui = rxcuiSchema.parse(
    await fetchJson(
      `${RXNAV}/rxcui.json?name=${encodeURIComponent(name)}&search=2`,
      fetchBytes,
    ),
  ).idGroup.rxnormId?.[0];
  if (!rxcui) {
    return { brands: [], classes: [] };
  }
  const products = brandedSchema.parse(
    await fetchJson(`${RXNAV}/rxcui/${rxcui}/related.json?tty=SBD`, fetchBytes),
  );
  const brands = new Set(
    (products.relatedGroup.conceptGroup ?? [])
      .flatMap((group) => group.conceptProperties ?? [])
      .filter((product) => !product.name.includes(' / '))
      .flatMap((product) => /\[([^\]]+)\]/.exec(product.name)?.[1] ?? []),
  );
  const classes = new Set(
    (
      classSchema.parse(
        await fetchJson(
          `${RXNAV}/rxclass/class/byRxcui.json?rxcui=${rxcui}&relaSource=FDASPL&relas=has_EPC`,
          fetchBytes,
        ),
      ).rxclassDrugInfoList?.rxclassDrugInfo ?? []
    ).map((info) => info.rxclassMinConceptItem.className),
  );
  return { brands: [...brands].sort(), classes: [...classes].sort() };
}

async function fetchJson(
  url: string,
  fetchBytes: (url: string) => Promise<Uint8Array>,
): Promise<unknown> {
  return JSON.parse(decode(await fetchBytes(url)));
}

function webpage(bytes: Uint8Array): ParsedDocument {
  return {
    kind: 'webpage',
    blocks: markdownToBlocks(htmlToMarkdown(decode(bytes))),
  };
}

function decode(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
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
