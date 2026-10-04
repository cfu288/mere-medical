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
import {
  ParsedDocument,
  Section,
  Spoke,
  buildSections,
  buildSpokeSections,
} from './sections';
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

const OPENFDA_LABELS = 'https://api.fda.gov/drug/label.json';
const RXNAV = 'https://rxnav.nlm.nih.gov/REST';

const labelSearchSchema = z.object({
  results: z
    .tuple([
      z.object({
        set_id: z.string().min(1),
        effective_time: z.string().min(8),
        openfda: z
          .object({
            brand_name: z.array(z.string()).optional(),
            manufacturer_name: z.array(z.string()).optional(),
            application_number: z.array(z.string()).optional(),
          })
          .optional(),
      }),
    ])
    .rest(z.unknown()),
});
const countSchema = z.object({
  results: z.array(z.object({ term: z.string(), count: z.number() })),
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

/** One node per generic, one spoke per route it is sold in, each spoke the originator's label when one exists, else the newest. */
async function drugLabel(
  generic: string,
  fetchBytes: (url: string) => Promise<Uint8Array>,
): Promise<Fetched> {
  const base = `openfda.generic_name.exact:"${generic}" AND openfda.product_type.exact:"HUMAN PRESCRIPTION DRUG"`;
  const routes = countSchema
    .parse(await fetchJson(countUrl(base, 'openfda.route.exact'), fetchBytes))
    .results.map((r) => r.term)
    .sort();
  const spokes: Spoke[] = [];
  const years: string[] = [];
  for (const route of routes) {
    const scoped = `${base} AND openfda.route.exact:"${route}"`;
    const applications = countSchema
      .parse(
        await fetchJson(
          countUrl(scoped, 'openfda.application_number.exact'),
          fetchBytes,
        ),
      )
      .results.map((r) => r.term);
    const query = applications.some((a) => a.startsWith('NDA'))
      ? `${scoped} AND openfda.application_number:NDA*`
      : scoped;
    const label = labelSearchSchema.parse(
      await fetchJson(
        `${OPENFDA_LABELS}?search=${encodeURIComponent(query)}&sort=${encodeURIComponent('effective_time:desc')}&limit=1`,
        fetchBytes,
      ),
    ).results[0];
    const url = `https://dailymed.nlm.nih.gov/dailymed/fda/fdaDrugXsl.cfm?setid=${label.set_id}&type=display`;
    const maker = label.openfda?.manufacturer_name?.[0];
    const owner = label.openfda?.brand_name?.[0] ?? maker ?? 'label';
    const effective = `${label.effective_time.slice(0, 4)}-${label.effective_time.slice(4, 6)}-${label.effective_time.slice(6, 8)}`;
    years.push(label.effective_time.slice(0, 4));
    spokes.push({
      id: routeSlug(route),
      title: `${routeTitle(route)}: ${owner}`,
      url,
      contentMd: `Label ${label.openfda?.application_number?.[0] ?? 'unknown'}${maker ? ` by ${maker}` : ''}, effective ${effective}.`,
      document: webpage(await fetchBytes(url)),
    });
  }
  const name = generic.charAt(0) + generic.slice(1).toLowerCase();
  const { brands, classes } = await brandsAndClasses(
    generic.toLowerCase(),
    fetchBytes,
  );
  return {
    title: `FDA drug label: ${name}`,
    edition: years.sort().reverse()[0] ?? '',
    summary: [
      brands.length > 0 ? `${name} (brands: ${brands.join(', ')})` : name,
      ...(classes.length > 0 ? [classes.join(', ')] : []),
      `routes: ${routes
        .map(routeSlug)
        .map((r) => r.replace(/-/g, ' '))
        .join(', ')}`,
      'FDA prescribing information: uses, dosing, warnings, side effects, interactions',
    ].join('; '),
    url: `https://dailymed.nlm.nih.gov/dailymed/search.cfm?labeltype=all&query=${encodeURIComponent(generic.toLowerCase())}`,
    spokes,
  };
}

function countUrl(search: string, field: string): string {
  return `${OPENFDA_LABELS}?search=${encodeURIComponent(search)}&count=${field}`;
}

function routeSlug(route: string): string {
  return route
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function routeTitle(route: string): string {
  const lower = route.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
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
