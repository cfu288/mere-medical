/**
 * Read API over the shipped `tenants.db` artifact. `apps/api` calls it to serve
 * tenant search and lookup at runtime; it never reaches back into the pipeline
 * warehouse, so the api ships without any build-time data dependency.
 */
import { DatabaseSync } from 'node:sqlite';
import { allRows, getRow } from './rows';
import { TENANT_DB_USER_VERSION } from './schema';
import type {
  EndpointSource,
  FhirVersion,
  SearchableVendor,
  Tenant,
  Vendor,
} from '@mere/shared';

/** An open handle to a `tenants.db` artifact. */
export type TenantDb = DatabaseSync;

const DEFAULT_SEARCH_LIMIT = 50;

/** The picker opens on this list before anyone types. */
const DEFAULT_BROWSE_LIMIT = 100;

interface TenantSqlRow {
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

const SELECT_COLUMNS = `t.tenant_id, t.vendor, t.fhir_version, t.name, t.url,
  t.token, t.authorize, t.register, t.managing_organization,
  t.source, t.searchable`;

function toTenant(row: TenantSqlRow): Tenant {
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
 * Opens the shipped tenant catalog read-only.
 *
 * Fails here rather than returning empty results forever: a stale or truncated artifact
 * is a deploy problem, and an empty tenant picker looks identical to "no matches".
 */
export function openTenantDb(dbPath: string): TenantDb {
  const db = new DatabaseSync(dbPath, { readOnly: true });

  const version =
    getRow<{ user_version: number }>(db.prepare('PRAGMA user_version'))
      ?.user_version ?? 0;
  if (version !== TENANT_DB_USER_VERSION) {
    db.close();
    throw new Error(
      `${dbPath} has schema version ${version}, expected ${TENANT_DB_USER_VERSION}`,
    );
  }

  const count = getRow<{ n: number }>(
    db.prepare('SELECT COUNT(*) AS n FROM tenants'),
  );
  if (!count || count.n === 0) {
    db.close();
    throw new Error(`${dbPath} holds no tenants`);
  }

  return db;
}

/**
 * Turns arbitrary user input into an FTS5 prefix query, or null when it holds no
 * searchable token.
 *
 * Every token is quoted, so FTS operators a user types (`AND`, `*`, `"`, `NEAR`) are
 * matched as text instead of changing the meaning of the query.
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

function filterClauses(options: SearchOptions): {
  sql: string;
  params: Record<string, string>;
} {
  const clauses: string[] = [];
  const params: Record<string, string> = {};

  if (options.vendors?.length) {
    const names = options.vendors.map((vendor, index) => {
      params[`vendor${index}`] = vendor;
      return `:vendor${index}`;
    });
    clauses.push(`t.vendor IN (${names.join(', ')})`);
  }
  if (options.fhirVersion) {
    clauses.push('t.fhir_version = :fhirVersion');
    params['fhirVersion'] = options.fhirVersion;
  }
  if (options.source) {
    clauses.push('t.source = :source');
    params['source'] = options.source;
  }
  return { sql: clauses.map((clause) => ` AND ${clause}`).join(''), params };
}

/**
 * Full-text search over searchable tenants, ranked by FTS5 relevance.
 *
 * An empty query lists tenants by name instead of matching nothing, which is what the
 * picker shows before anyone types. An empty `vendors` array matches nothing, so a
 * caller that recognised none of the vendors it was asked for cannot fall through to
 * returning every vendor.
 */
export function searchTenants(
  db: TenantDb,
  query: unknown,
  options: SearchOptions = {},
): Tenant[] {
  if (query != null && typeof query !== 'string') return [];
  if (options.vendors && options.vendors.length === 0) return [];
  const safeQuery = query ?? '';
  const { sql: filters, params } = filterClauses(options);
  const match = toFtsQuery(safeQuery);
  const browsing = safeQuery.trim() === '';
  const limit = browsing ? DEFAULT_BROWSE_LIMIT : DEFAULT_SEARCH_LIMIT;

  if (!browsing && !match) return [];

  if (!match) {
    return allRows<TenantSqlRow>(
      db.prepare(
        `SELECT ${SELECT_COLUMNS} FROM tenants t
         WHERE t.searchable = 1${filters}
         ORDER BY t.name COLLATE NOCASE LIMIT :limit`,
      ),
      { ...params, limit },
    ).map(toTenant);
  }

  return allRows<TenantSqlRow>(
    db.prepare(
      `SELECT ${SELECT_COLUMNS} FROM tenants t
       JOIN tenants_fts f ON f.rowid = t.id
       WHERE tenants_fts MATCH :match AND t.searchable = 1${filters}
       ORDER BY f.rank LIMIT :limit`,
    ),
    { ...params, match, limit },
  ).map(toTenant);
}

/**
 * One tenant by vendor and id.
 *
 * With no version given and a tenant published under both, returns the R4 row: 1,168
 * Cerner ids exist in DSTU2 and R4, and R4 is the newer contract.
 */
export function findTenantById(
  db: TenantDb,
  vendor: Vendor,
  tenantId: string,
  fhirVersion?: FhirVersion,
): Tenant | null {
  const row = getRow<TenantSqlRow>(
    db.prepare(
      `SELECT ${SELECT_COLUMNS} FROM tenants t
       WHERE t.vendor = :vendor AND t.tenant_id = :tenantId
         AND (:fhirVersion IS NULL OR t.fhir_version = :fhirVersion)
       ORDER BY CASE t.fhir_version WHEN 'R4' THEN 0 ELSE 1 END
       LIMIT 1`,
    ),
    { vendor, tenantId, fhirVersion: fhirVersion ?? null },
  );

  return row ? toTenant(row) : null;
}
