import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { Insertable, Kysely } from 'kysely';
import {
  TENANT_DB_SCHEMA,
  TENANT_DB_USER_VERSION,
  TenantDatabase,
  TenantDb,
  TenantsTable,
  nodeSqliteDialect,
  openTenantDb,
} from '@mere/tenant-db';

export interface TenantSeed {
  tenantId: string;
  vendor: string;
  fhirVersion: 'DSTU2' | 'R4';
  name: string;
  url: string;
  token?: string;
  authorize?: string;
  register?: string;
  managingOrganization?: string;
  source?: 'directory' | 'sandbox';
  searchable?: boolean;
}

export interface SeededTenantDb {
  db: TenantDb;
  close: () => Promise<void>;
}

/** Opens a throwaway tenants.db seeded with the given rows. */
export async function openSeededTenantDb(
  tenants: TenantSeed[],
): Promise<SeededTenantDb> {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tenant-db-'));
  const artifactPath = path.join(dir, 'tenants.db');
  const raw = new DatabaseSync(artifactPath);
  raw.exec(TENANT_DB_SCHEMA);
  raw.exec(`PRAGMA user_version = ${TENANT_DB_USER_VERSION}`);

  const rows: Insertable<TenantsTable>[] = tenants.map((tenant) => ({
    tenant_id: tenant.tenantId,
    vendor: tenant.vendor,
    fhir_version: tenant.fhirVersion,
    name: tenant.name,
    url: tenant.url,
    token: tenant.token ?? null,
    authorize: tenant.authorize ?? null,
    register: tenant.register ?? null,
    managing_organization: tenant.managingOrganization ?? null,
    source: tenant.source ?? 'directory',
    searchable: tenant.searchable === false ? 0 : 1,
    last_seen_in_directory: '2026-09-01T00:00:00.000Z',
  }));

  const writer = new Kysely<TenantDatabase>({
    dialect: nodeSqliteDialect(raw),
  });
  await writer.insertInto('tenants').values(rows).execute();
  await writer
    .insertInto('tenants_fts')
    .columns(['rowid', 'name', 'managing_organization'])
    .expression(
      writer
        .selectFrom('tenants')
        .select(['id', 'name', 'managing_organization'])
        .where('searchable', '=', 1),
    )
    .execute();
  await writer.destroy();

  const db = openTenantDb(artifactPath);
  return {
    db,
    close: async () => {
      await db.destroy();
      fs.rmSync(dir, { recursive: true, force: true });
    },
  };
}
