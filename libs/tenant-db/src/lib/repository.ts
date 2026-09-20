/**
 * Read API over the shipped `tenants.db`. `apps/api` serves search and lookup
 * from it and never reaches back into the pipeline warehouse.
 */
import { DatabaseSync } from 'node:sqlite';
import { Kysely, Selectable, sql } from 'kysely';
import { nodeSqliteDialect } from './node-sqlite';
import { TENANT_DB_USER_VERSION } from './schema';
import type { TenantDatabase, TenantsTable } from './tenant-db-schema';
import type {
  EndpointSource,
  FhirVersion,
  LoginTenant,
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
  't.kind',
] as const;

type TenantRow = Pick<
  Selectable<TenantsTable>,
  | 'tenant_id'
  | 'vendor'
  | 'fhir_version'
  | 'name'
  | 'url'
  | 'token'
  | 'authorize'
  | 'register'
  | 'managing_organization'
  | 'source'
  | 'kind'
>;

function toTenant(row: TenantRow): Tenant {
  const base = {
    tenantId: row.tenant_id,
    vendor: row.vendor as Vendor,
    fhirVersion: row.fhir_version as FhirVersion,
    name: row.name,
    url: row.url,
    managingOrganization: row.managing_organization ?? undefined,
    source: row.source as EndpointSource,
  };
  if (row.kind === 'lookup') {
    return { ...base, kind: 'lookup' };
  }
  if (row.token == null || row.authorize == null) {
    throw new Error(
      `${row.vendor} ${row.tenant_id} is a login row without auth urls`,
    );
  }
  return {
    ...base,
    kind: 'login',
    token: row.token,
    authorize: row.authorize,
    register: row.register ?? undefined,
  };
}

function toLoginTenant(row: TenantRow): LoginTenant {
  const tenant = toTenant(row);
  if (tenant.kind !== 'login') {
    throw new Error(`${row.vendor} ${row.tenant_id} is not a login row`);
  }
  return tenant;
}

/**
 * Opens the shipped tenant catalog read-only.
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
 * Turns user input into an FTS5 prefix query, or null when it holds no word.
 * `st. mary's` becomes `"st"* "mary"* "s"*`, and `NEAR OR *` becomes
 * `"NEAR"* "OR"*`.
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
 * Full-text search over login tenants, ranked by FTS5 relevance.
 */
export async function searchTenants(
  db: TenantDb,
  query: unknown,
  options: SearchOptions = {},
): Promise<LoginTenant[]> {
  if (query != null && typeof query !== 'string') return [];
  if (options.vendors && options.vendors.length === 0) return [];
  const safeQuery = query ?? '';
  const match = toFtsQuery(safeQuery);
  const browsing = safeQuery.trim() === '';
  if (!browsing && !match) return [];

  let builder = db
    .selectFrom('tenants as t')
    .select(SELECT_COLUMNS)
    .where('t.kind', '=', 'login');
  if (options.vendors?.length) {
    builder = builder.where('t.vendor', 'in', options.vendors);
  }
  if (options.fhirVersion) {
    builder = builder.where('t.fhir_version', '=', options.fhirVersion);
  }
  if (options.source) {
    builder = builder.where('t.source', '=', options.source);
  }

  builder = match
    ? builder
        .innerJoin('tenants_fts as f', 'f.rowid', 't.id')
        .where(sql<boolean>`tenants_fts MATCH ${match}`)
        .orderBy('f.rank')
        .limit(DEFAULT_SEARCH_LIMIT)
    : builder
        .orderBy('t.name', (ob) => ob.collate('nocase'))
        .limit(DEFAULT_BROWSE_LIMIT);

  const rows = await builder.execute();
  return rows.map(toLoginTenant);
}

/**
 * One tenant by vendor and id. If fhirVersion is not specified and multiple
 * tenants match the id, the R4 one is returned.
 */
export async function findTenantById(
  db: TenantDb,
  vendor: Vendor,
  tenantId: string,
  fhirVersion?: FhirVersion,
): Promise<Tenant | null> {
  let builder = db
    .selectFrom('tenants as t')
    .select(SELECT_COLUMNS)
    .where('t.vendor', '=', vendor)
    .where('t.tenant_id', '=', tenantId);
  if (fhirVersion) {
    builder = builder.where('t.fhir_version', '=', fhirVersion);
  }
  const row = await builder
    .orderBy((eb) =>
      eb.case().when('t.fhir_version', '=', 'R4').then(0).else(1).end(),
    )
    .limit(1)
    .executeTakeFirst();

  return row ? toTenant(row) : null;
}
