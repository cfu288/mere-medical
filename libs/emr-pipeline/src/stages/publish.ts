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
import * as snapshots from '../db/repository/directory-snapshots';
import * as publications from '../db/repository/publications';

interface PublishOptions {
  artifactPath: string;
  now: () => string;
  log: (message: string) => void;
}

/** Writes a fresh tenants.db beside `artifactPath` and renames it into place. */
function buildArtifact(
  db: DatabaseSync,
  artifactPath: string,
): { rowCount: number } {
  fs.mkdirSync(path.dirname(artifactPath), { recursive: true });

  const tenants = derived.listPublishable(db);
  const seenAt =
    snapshots.latestFetchedAtOverall(db) ?? '1970-01-01T00:00:00.000Z';

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
 * Writes the artifact at `options.artifactPath` from the warehouse's publishable
 * tenants plus every adapter's sandbox seeds, and records the publish in the warehouse.
 * The artifact is built beside its target and renamed into place, so a reader never
 * sees a half-written file.
 */
export function publish(
  db: DatabaseSync,
  options: PublishOptions,
): PublishResult {
  const artifact = buildArtifact(db, options.artifactPath);
  publications.record(db, options.now(), artifact.rowCount);

  options.log(`wrote ${options.artifactPath}: ${artifact.rowCount} rows`);
  return { rowCount: artifact.rowCount };
}
