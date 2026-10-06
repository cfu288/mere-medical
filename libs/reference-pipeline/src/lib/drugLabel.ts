import { z } from 'zod';

import { Spoke } from './sections';
import { fetchJson, webpage } from './webpage';

export type DrugLabel = {
  title: string;
  edition: string;
  summary: string;
  url: string;
  spokes: Spoke[];
};

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
export async function drugLabel(
  generic: string,
  fetchBytes: (url: string) => Promise<Uint8Array>,
): Promise<DrugLabel> {
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
