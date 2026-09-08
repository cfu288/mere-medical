import { DatabaseSync } from 'node:sqlite';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { ADAPTERS } from './adapters';
import {
  TENANT_DB_SCHEMA,
  TENANT_DB_USER_VERSION,
  getRow,
} from '@mere/tenant-db';

interface PublishOptions {
  warehousePath: string;
  artifactPath: string;
  now: () => string;
  log: (message: string) => void;
}

/** Writes `tenants.db` from scratch, so a stale row cannot survive into the artifact. */
export function buildArtifact(
  warehousePath: string,
  artifactPath: string,
): { rowCount: number } {
  fs.mkdirSync(path.dirname(artifactPath), { recursive: true });
  return writeArtifact(warehousePath, artifactPath);
}

function writeArtifact(
  warehousePath: string,
  artifactPath: string,
): { rowCount: number } {
  const building = `${artifactPath}.building`;
  for (const stale of [building, `${building}-wal`, `${building}-shm`]) {
    fs.rmSync(stale, { force: true });
  }

  const artifact = new DatabaseSync(building);
  try {
    artifact.exec(TENANT_DB_SCHEMA);
    artifact.exec(`PRAGMA user_version = ${TENANT_DB_USER_VERSION}`);
    artifact.prepare('ATTACH ? AS w').run(warehousePath);

    artifact.exec(
      `INSERT INTO tenants (tenant_id, vendor, fhir_version, name, url, token, authorize,
                            register, managing_organization, source, searchable,
                            last_seen_in_directory)
       WITH usable AS (
         SELECT u.vendor, u.fhir_version, u.tenant_id, u.url,
                c.token_url, c.authorize_url, c.register_url, u.last_seen_at
         FROM w.tenant_urls u
         JOIN w.tenant_capabilities c
           ON c.vendor = u.vendor AND c.fhir_version = u.fhir_version AND c.url = u.url
         WHERE c.classification = 'usable'
       ),
       best AS (
         SELECT d.id AS entry_id, s.token_url, s.authorize_url, s.register_url,
                ROW_NUMBER() OVER (
                  PARTITION BY d.id
                  ORDER BY (s.url = d.url) DESC, s.last_seen_at DESC
                ) AS rank
         FROM w.tenant_directory_entries d
         JOIN usable s
           ON s.vendor = d.vendor AND s.fhir_version = d.fhir_version
          AND s.tenant_id = d.tenant_id
       )
       SELECT d.tenant_id, d.vendor, d.fhir_version, coalesce(d.name, ''), d.url,
              b.token_url, b.authorize_url, b.register_url,
              d.managing_organization, 'directory',
              CASE d.vendor WHEN 'athena' THEN 0 ELSE 1 END,
              d.last_seen_in_directory
       FROM w.tenant_directory_entries d
       LEFT JOIN best b ON b.entry_id = d.id AND b.rank = 1
       WHERE CASE d.vendor
               WHEN 'athena' THEN 1
               ELSE trim(coalesce(d.name, '')) <> '' AND b.entry_id IS NOT NULL
             END
       ORDER BY d.vendor, d.fhir_version, d.tenant_id`,
    );

    const asOf =
      getRow<{ t: string | null }>(
        artifact.prepare(
          'SELECT MAX(fetched_at) AS t FROM w.directory_snapshots',
        ),
      )?.t ?? '1970-01-01T00:00:00.000Z';
    const insertSeed = artifact.prepare(
      `INSERT INTO tenants
         (tenant_id, vendor, fhir_version, name, url, token, authorize, register,
          managing_organization, source, searchable, last_seen_in_directory)
       VALUES (?, ?, ?, ?, ?, ?, ?, NULL, NULL, 'sandbox', 1, ?)`,
    );
    for (const [vendor, adapter] of Object.entries(ADAPTERS)) {
      for (const version of adapter.versions) {
        for (const seed of adapter.sandbox(version)) {
          insertSeed.run(
            seed.tenantId,
            vendor,
            version,
            seed.name,
            seed.url,
            seed.token ?? null,
            seed.authorize ?? null,
            asOf,
          );
        }
      }
    }

    artifact.exec(
      `INSERT INTO tenants_fts (rowid, name, managing_organization)
       SELECT id, name, managing_organization FROM tenants`,
    );
    artifact.exec('DETACH w');
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

export function publish(
  db: DatabaseSync,
  options: PublishOptions,
): PublishResult {
  const artifact = buildArtifact(options.warehousePath, options.artifactPath);
  db.prepare(
    `INSERT INTO publications (published_at, row_count) VALUES (?, ?)`,
  ).run(options.now(), artifact.rowCount);

  options.log(`wrote ${options.artifactPath}: ${artifact.rowCount} rows`);
  return { rowCount: artifact.rowCount };
}
