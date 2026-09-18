import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import {
  TENANT_DB_SCHEMA,
  TENANT_DB_USER_VERSION,
  TenantDb,
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

/**
 * Opens a throwaway tenants.db seeded with the given rows, so specs assert
 * against literal data instead of the committed artifact that changes with
 * every monthly refresh.
 */
export function openSeededTenantDb(tenants: TenantSeed[]): SeededTenantDb {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tenant-db-'));
  const artifactPath = path.join(dir, 'tenants.db');
  const artifact = new DatabaseSync(artifactPath);
  artifact.exec(TENANT_DB_SCHEMA);
  artifact.exec(`PRAGMA user_version = ${TENANT_DB_USER_VERSION}`);
  const insert = artifact.prepare(
    `INSERT INTO tenants
       (tenant_id, vendor, fhir_version, name, url, token, authorize, register,
        managing_organization, source, searchable, last_seen_in_directory)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  for (const tenant of tenants) {
    insert.run(
      tenant.tenantId,
      tenant.vendor,
      tenant.fhirVersion,
      tenant.name,
      tenant.url,
      tenant.token ?? null,
      tenant.authorize ?? null,
      tenant.register ?? null,
      tenant.managingOrganization ?? null,
      tenant.source ?? 'directory',
      tenant.searchable === false ? 0 : 1,
      '2026-09-01T00:00:00.000Z',
    );
  }
  artifact.exec(
    `INSERT INTO tenants_fts (rowid, name, managing_organization)
     SELECT id, name, managing_organization FROM tenants WHERE searchable = 1`,
  );
  artifact.close();
  const db = openTenantDb(artifactPath);
  return {
    db,
    close: async () => {
      await db.destroy();
      fs.rmSync(dir, { recursive: true, force: true });
    },
  };
}
