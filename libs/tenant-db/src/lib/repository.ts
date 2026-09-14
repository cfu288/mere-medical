/**
 * Read API over the shipped `tenants.db`. `apps/api` serves search and lookup
 * from it and never reaches back into the pipeline warehouse.
 */
import { DatabaseSync } from 'node:sqlite';
import { Kysely, sql } from 'kysely';
import { nodeSqliteDialect } from './node-sqlite';
import { TENANT_DB_USER_VERSION } from './schema';
import type { TenantDatabase } from './tenant-db-schema';
import type {
  EndpointSource,
  FhirVersion,
  SearchableVendor,
  Tenant,
  Vendor,
} from '@mere/shared';

/** An open handle to a `tenants.db` artifact. */
export type TenantDb = Kysely<TenantDatabase>;

const DEFAULT_SEARCH_LIMIT = 50;

/** The picker opens on this list before anyone types. */
const DEFAULT_BROWSE_LIMIT = 100;

const SELECT_COLUMNS = [
  't.tenant_id',
  't.vendor',
  't.fhir_version',
  't.name',
  't.url',
  't.token',
  't.authorize',
  't.register',
  't.managing_organization',
  't.source',
  't.searchable',
] as const;

interface TenantRow {
  tenant_id: string;
  vendor: string;
  fhir_version: string;
  name: string;
  url: string;
  token: string | null;
  authorize: string | null;
  register: string | null;
  managing_organization: string | null;
  source: string;
  searchable: number;
}

function toTenant(row: TenantRow): Tenant {
  return {
    tenantId: row.tenant_id,
    vendor: row.vendor as Vendor,
    fhirVersion: row.fhir_version as FhirVersion,
    name: row.name,
    url: row.url,
    token: row.token ?? undefined,
    authorize: row.authorize ?? undefined,
    register: row.register ?? undefined,
    managingOrganization: row.managing_organization ?? undefined,
    source: row.source as EndpointSource,
    searchable: row.searchable === 1,
  };
}

/**
 * Opens the shipped tenant catalog read-only. A stale or truncated artifact fails
 * here at boot, because an empty tenant picker would look identical to "no matches".
 */
export function openTenantDb(dbPath: string): TenantDb {
  const db = new DatabaseSync(dbPath, { readOnly: true });

  const version =
    (db.prepare('PRAGMA user_version').get() as { user_version: number })
      ?.user_version ?? 0;
  if (version !== TENANT_DB_USER_VERSION) {
    db.close();
    throw new Error(
      `${dbPath} has schema version ${version}, expected ${TENANT_DB_USER_VERSION}`,
    );
  }

  const count = db.prepare('SELECT COUNT(*) AS n FROM tenants').get() as {
    n: number;
  };
  if (!count || count.n === 0) {
    db.close();
    throw new Error(`${dbPath} holds no tenants`);
  }

  return new Kysely<TenantDatabase>({ dialect: nodeSqliteDialect(db) });
}

/**
 * Turns user input into a quoted FTS5 prefix query, or null when nothing is
 * searchable. Quoting makes typed operators match as plain text.
 */
export function toFtsQuery(query: string): string | null {
  return (
    query
      .match(/[\p{L}\p{N}]+/gu)
      ?.map((token) => `"${token}"*`)
      .join(' ') ?? null
  );
}

interface SearchOptions {
  vendors?: SearchableVendor[];
  fhirVersion?: FhirVersion;
  source?: EndpointSource;
}

/**
 * Full-text search over searchable tenants, ranked by FTS5 relevance. An empty
 * query lists tenants by name, the picker's initial view. An empty `vendors`
 * array matches nothing rather than every vendor.
 */
export async function searchTenants(
  db: TenantDb,
  query: unknown,
  options: SearchOptions = {},
): Promise<Tenant[]> {
  if (query != null && typeof query !== 'string') return [];
  if (options.vendors && options.vendors.length === 0) return [];
  const safeQuery = query ?? '';
  const match = toFtsQuery(safeQuery);
  const browsing = safeQuery.trim() === '';
  if (!browsing && !match) return [];

  let builder = db
    .selectFrom('tenants as t')
    .select(SELECT_COLUMNS)
    .where('t.searchable', '=', 1)
    .$if(!!options.vendors?.length, (qb) =>
      qb.where('t.vendor', 'in', options.vendors as string[]),
    )
    .$if(options.fhirVersion !== undefined, (qb) =>
      qb.where('t.fhir_version', '=', options.fhirVersion as string),
    )
    .$if(options.source !== undefined, (qb) =>
      qb.where('t.source', '=', options.source as string),
    );

  builder = match
    ? builder
        .innerJoin('tenants_fts as f', 'f.rowid', 't.id')
        .where(sql<boolean>`tenants_fts MATCH ${match}`)
        .orderBy(sql`f.rank`)
        .limit(DEFAULT_SEARCH_LIMIT)
    : builder.orderBy(sql`t.name COLLATE NOCASE`).limit(DEFAULT_BROWSE_LIMIT);

  const rows = await builder.execute();
  return rows.map(toTenant);
}

/**
 * One tenant by vendor and id. Ids published under both versions return the R4
 * row, the newer contract.
 */
export async function findTenantById(
  db: TenantDb,
  vendor: Vendor,
  tenantId: string,
  fhirVersion?: FhirVersion,
): Promise<Tenant | null> {
  const row = await db
    .selectFrom('tenants as t')
    .select(SELECT_COLUMNS)
    .where('t.vendor', '=', vendor)
    .where('t.tenant_id', '=', tenantId)
    .$if(fhirVersion !== undefined, (qb) =>
      qb.where('t.fhir_version', '=', fhirVersion as string),
    )
    .orderBy(sql`CASE t.fhir_version WHEN 'R4' THEN 0 ELSE 1 END`)
    .limit(1)
    .executeTakeFirst();

  return row ? toTenant(row) : null;
}
