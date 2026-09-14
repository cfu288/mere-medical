/**
 * Owns the staging tables `tenant_names`, `tenant_listings`, and
 * `url_smart_security`. Transform rebuilds them from the snapshots so publish
 * is one query instead of rereading history.
 */
import { sql } from 'kysely';
import type {
  CapabilityClassification,
  FhirVersion,
  Vendor,
} from '@mere/shared';
import type { Warehouse } from '../open';

/**
 * One tenant as its vendor's directory has ever listed it: merged name, and
 * every url with the date of the newest snapshot listing it there. The
 * current listing is the url with the newest date, computed at query time.
 */
export interface TenantListing {
  tenantId: string;
  name?: string;
  managingOrganization?: string;
  urls: { url: string; lastSeenAt: string }[];
}

/**
 * One url's SMART auth urls and whether they are complete enough to log in
 * with. `listPublishable` keeps only `usable` rows.
 */
export interface UrlSmartSecurity {
  url: string;
  authorizeUrl: string | null;
  tokenUrl: string | null;
  registerUrl: string | null;
  classification: CapabilityClassification;
}

/**
 * Deletes and rewrites a vendor and version's whole tenant model in the
 * caller's transaction, always all three tables together.
 */
export async function replace(
  db: Warehouse,
  vendor: Vendor,
  fhirVersion: FhirVersion,
  listings: TenantListing[],
  capabilities: UrlSmartSecurity[],
): Promise<void> {
  for (const table of [
    'tenant_names',
    'tenant_listings',
    'url_smart_security',
  ] as const) {
    await db
      .deleteFrom(table)
      .where('vendor', '=', vendor)
      .where('fhir_version', '=', fhirVersion)
      .execute();
  }

  for (const listing of listings) {
    await db
      .insertInto('tenant_names')
      .values({
        vendor,
        fhir_version: fhirVersion,
        tenant_id: listing.tenantId,
        name: listing.name ?? null,
        managing_organization: listing.managingOrganization ?? null,
      })
      .execute();
    for (const seen of listing.urls) {
      await db
        .insertInto('tenant_listings')
        .values({
          vendor,
          fhir_version: fhirVersion,
          tenant_id: listing.tenantId,
          url: seen.url,
          last_seen_at: seen.lastSeenAt,
        })
        .execute();
    }
  }

  for (const capability of capabilities) {
    await db
      .insertInto('url_smart_security')
      .values({
        vendor,
        fhir_version: fhirVersion,
        url: capability.url,
        authorize_url: capability.authorizeUrl,
        token_url: capability.tokenUrl,
        register_url: capability.registerUrl,
        classification: capability.classification,
      })
      .onConflict((oc) =>
        oc.columns(['vendor', 'fhir_version', 'url']).doNothing(),
      )
      .execute();
  }
}

/**
 * A tenant ready to ship, named unless athena, with its best usable auth urls.
 */
interface PublishableTenant {
  tenant_id: string;
  vendor: string;
  fhir_version: string;
  name: string;
  url: string;
  token: string | null;
  authorize: string | null;
  register: string | null;
  managing_organization: string | null;
  searchable: number;
  last_seen_in_directory: string;
}

/**
 * Returns every publishable tenant with auth urls from its current url's usable
 * CapabilityStatement, else its most recent usable one. Publish writes exactly
 * this list to the artifact. The current listing is the tenant's newest
 * `tenant_listings` row, ties broken by highest id.
 */
export async function listPublishable(
  db: Warehouse,
): Promise<PublishableTenant[]> {
  const rows = await db
    .with('ranked', (qb) =>
      qb.selectFrom('tenant_listings as l').select((eb) => [
        'l.vendor',
        'l.fhir_version',
        'l.tenant_id',
        'l.url',
        'l.last_seen_at',
        eb.fn
          .agg<number>('row_number')
          .over((ob) =>
            ob
              .partitionBy(['l.vendor', 'l.fhir_version', 'l.tenant_id'])
              .orderBy('l.last_seen_at', 'desc')
              .orderBy('l.id', 'desc'),
          )
          .as('rn'),
      ]),
    )
    .with('current', (qb) =>
      qb.selectFrom('ranked').selectAll().where('rn', '=', 1),
    )
    .with('usable', (qb) =>
      qb
        .selectFrom('tenant_listings as l')
        .innerJoin('url_smart_security as c', (join) =>
          join
            .onRef('c.vendor', '=', 'l.vendor')
            .onRef('c.fhir_version', '=', 'l.fhir_version')
            .onRef('c.url', '=', 'l.url'),
        )
        .where('c.classification', '=', 'usable')
        .select([
          'l.vendor',
          'l.fhir_version',
          'l.tenant_id',
          'l.url',
          'l.last_seen_at',
          'l.id',
          'c.token_url',
          'c.authorize_url',
          'c.register_url',
        ]),
    )
    .with('best', (qb) =>
      qb
        .selectFrom('usable as u')
        .innerJoin('current as cur', (join) =>
          join
            .onRef('cur.vendor', '=', 'u.vendor')
            .onRef('cur.fhir_version', '=', 'u.fhir_version')
            .onRef('cur.tenant_id', '=', 'u.tenant_id'),
        )
        .select((eb) => [
          'u.vendor',
          'u.fhir_version',
          'u.tenant_id',
          'u.token_url',
          'u.authorize_url',
          'u.register_url',
          eb.fn
            .agg<number>('row_number')
            .over((ob) =>
              ob
                .partitionBy(['u.vendor', 'u.fhir_version', 'u.tenant_id'])
                .orderBy(sql`(u.url = cur.url) desc`)
                .orderBy('u.last_seen_at', 'desc')
                .orderBy('u.id', 'desc'),
            )
            .as('rn'),
        ]),
    )
    .selectFrom('current as cur')
    .leftJoin('tenant_names as n', (join) =>
      join
        .onRef('n.vendor', '=', 'cur.vendor')
        .onRef('n.fhir_version', '=', 'cur.fhir_version')
        .onRef('n.tenant_id', '=', 'cur.tenant_id'),
    )
    .leftJoin('best as b', (join) =>
      join
        .onRef('b.vendor', '=', 'cur.vendor')
        .onRef('b.fhir_version', '=', 'cur.fhir_version')
        .onRef('b.tenant_id', '=', 'cur.tenant_id')
        .on('b.rn', '=', 1),
    )
    .select((eb) => [
      'cur.tenant_id',
      'cur.vendor',
      'cur.fhir_version',
      eb.fn.coalesce('n.name', sql<string>`''`).as('name'),
      'cur.url',
      'b.token_url as token',
      'b.authorize_url as authorize',
      'b.register_url as register',
      'n.managing_organization',
      eb
        .case()
        .when('cur.vendor', '=', 'athena')
        .then(0)
        .else(1)
        .end()
        .as('searchable'),
      'cur.last_seen_at as last_seen_in_directory',
    ])
    .where((eb) =>
      eb.or([
        eb('cur.vendor', '=', 'athena'),
        eb.and([
          sql<boolean>`trim(coalesce(n.name, '')) <> ''`,
          eb('b.tenant_id', 'is not', null),
        ]),
      ]),
    )
    .orderBy('cur.vendor')
    .orderBy('cur.fhir_version')
    .orderBy('cur.tenant_id')
    .execute();

  return rows as PublishableTenant[];
}
