import { DatabaseSync } from 'node:sqlite';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { ADAPTERS } from '../adapters';
import {
  TENANT_DB_SCHEMA,
  TENANT_DB_USER_VERSION,
  getRow,
} from '@mere/tenant-db';
import * as derived from '../db/repository/derived-tenants';
import * as vendorTenantDirectory from '../db/repository/vendor-tenant-directory-snapshots';
import * as publications from '../db/repository/publications';

/**
 * Creates a brand-new tenants.db with every publishable and sandbox tenant and
 * returns its row count. Writes to a temporary `.building` file and swaps it onto
 * `artifactPath` with one rename at the end, so the old artifact stays intact
 * until the new one is complete.
 */
function buildArtifact(
  db: DatabaseSync,
  artifactPath: string,
): { rowCount: number } {
  fs.mkdirSync(path.dirname(artifactPath), { recursive: true });

  const tenants = derived.listPublishable(db);
  const seenAt =
    vendorTenantDirectory.latestFetchedAtOverall(db) ??
    '1970-01-01T00:00:00.000Z';

  const building = `${artifactPath}.building`;
  for (const stale of [building, `${building}-wal`, `${building}-shm`]) {
    fs.rmSync(stale, { force: true });
  }

  const artifact = new DatabaseSync(building);
  try {
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
        tenant.tenant_id,
        tenant.vendor,
        tenant.fhir_version,
        tenant.name,
        tenant.url,
        tenant.token,
        tenant.authorize,
        tenant.register,
        tenant.managing_organization,
        'directory',
        tenant.searchable,
        tenant.last_seen_in_directory,
      );
    }
    for (const [vendor, adapter] of Object.entries(ADAPTERS)) {
      for (const version of adapter.versions) {
        for (const seed of adapter.sandbox(version)) {
          insert.run(
            seed.tenantId,
            vendor,
            version,
            seed.name,
            seed.url,
            seed.token ?? null,
            seed.authorize ?? null,
            null,
            null,
            'sandbox',
            1,
            seenAt,
          );
        }
      }
    }

    artifact.exec(
      `INSERT INTO tenants_fts (rowid, name, managing_organization)
       SELECT id, name, managing_organization FROM tenants`,
    );
    const count = getRow<{ n: number }>(
      artifact.prepare('SELECT COUNT(*) AS n FROM tenants'),
    );
    artifact.exec('VACUUM');
    artifact.close();

    fs.renameSync(building, artifactPath);
    fs.rmSync(`${artifactPath}-wal`, { force: true });
    fs.rmSync(`${artifactPath}-shm`, { force: true });
    return { rowCount: count?.n ?? 0 };
  } catch (error) {
    if (artifact.isOpen) artifact.close();
    fs.rmSync(building, { force: true });
    throw error;
  }
}

interface PublishResult {
  rowCount: number;
}

/**
 * Writes the shipped tenant catalog `tenants.db` from the warehouse alone, so
 * publishing twice yields identical content. It holds every `listPublishable`
 * tenant plus every sandbox tenant, and the publish is recorded for the status
 * history.
 *
 * @returns The number of tenant rows written.
 * @example
 * const { rowCount } = publish(db, 'libs/tenant-db/data/tenants.db');
 */
export function publish(db: DatabaseSync, artifactPath: string): PublishResult {
  const artifact = buildArtifact(db, artifactPath);
  publications.record(db, new Date().toISOString(), artifact.rowCount);

  console.log(`wrote ${artifactPath}: ${artifact.rowCount} rows`);
  return { rowCount: artifact.rowCount };
}
