import { DatabaseSync } from 'node:sqlite';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { Kysely, sql } from 'kysely';
import { ADAPTERS } from '../adapters';
import {
  TENANT_DB_SCHEMA,
  TENANT_DB_USER_VERSION,
  nodeSqliteDialect,
} from '@mere/tenant-db';
import type { TenantDatabase } from '@mere/tenant-db';
import type { Warehouse } from '../db/open';
import { insertChunked } from '../db/insert-chunked';
import * as tenantListings from '../db/repository/tenant-listings';
import * as vendorTenantDirectory from '../db/repository/vendor-tenant-directory-snapshots';
import * as publications from '../db/repository/publications';

/**
 * Creates a brand-new tenants.db with every publishable and sandbox tenant and
 * returns its row count. Writes to a temporary `.building` file and swaps it
 * onto `artifactPath` with one rename at the end. The old artifact stays
 * intact until the new one is complete.
 */
async function buildArtifact(
  db: Warehouse,
  artifactPath: string,
): Promise<{ rowCount: number }> {
  fs.mkdirSync(path.dirname(artifactPath), { recursive: true });

  const tenants = await tenantListings.listPublishable(db);
  const seenAt =
    (await vendorTenantDirectory.latestFetchedAtOverall(db)) ??
    '1970-01-01T00:00:00.000Z';

  const building = `${artifactPath}.building`;
  for (const stale of [building, `${building}-wal`, `${building}-shm`]) {
    fs.rmSync(stale, { force: true });
  }

  const raw = new DatabaseSync(building);
  const artifact = new Kysely<TenantDatabase>({
    dialect: nodeSqliteDialect(raw),
  });
  try {
    raw.exec(TENANT_DB_SCHEMA);
    raw.exec(`PRAGMA user_version = ${TENANT_DB_USER_VERSION}`);

    const directoryRows = tenants.map((tenant) => ({
      tenant_id: tenant.tenant_id,
      vendor: tenant.vendor,
      fhir_version: tenant.fhir_version,
      name: tenant.name,
      url: tenant.url,
      token: tenant.token,
      authorize: tenant.authorize,
      register: tenant.register,
      managing_organization: tenant.managing_organization,
      source: 'directory',
      kind: tenant.kind,
      last_seen_in_directory: tenant.last_seen_in_directory,
    }));
    const sandboxRows = Object.entries(ADAPTERS).flatMap(([vendor, adapter]) =>
      adapter.versions.flatMap((version) =>
        adapter.sandbox(version).map((seed) => ({
          tenant_id: seed.tenantId,
          vendor,
          fhir_version: version,
          name: seed.name,
          url: seed.url,
          token: seed.token,
          authorize: seed.authorize,
          register: null,
          managing_organization: null,
          source: 'sandbox',
          kind: 'login' as const,
          last_seen_in_directory: seenAt,
        })),
      ),
    );

    const rows = [...directoryRows, ...sandboxRows];
    await artifact.transaction().execute(async (trx) => {
      await insertChunked(rows, (chunk) =>
        trx.insertInto('tenants').values(chunk).execute(),
      );
      await trx
        .insertInto('tenants_fts')
        .columns(['rowid', 'name', 'managing_organization'])
        .expression((eb) =>
          eb
            .selectFrom('tenants')
            .select(['id', 'name', 'managing_organization']),
        )
        .execute();
    });

    const count = await artifact
      .selectFrom('tenants')
      .select((eb) => eb.fn.countAll<number>().as('n'))
      .executeTakeFirstOrThrow();
    await sql`VACUUM`.execute(artifact);
    await artifact.destroy();

    fs.renameSync(building, artifactPath);
    fs.rmSync(`${artifactPath}-wal`, { force: true });
    fs.rmSync(`${artifactPath}-shm`, { force: true });
    return { rowCount: count.n };
  } catch (error) {
    await artifact.destroy().catch(() => undefined);
    try {
      raw.close();
    } catch {
      /* already closed by destroy */
    }
    fs.rmSync(building, { force: true });
    throw error;
  }
}

interface PublishResult {
  rowCount: number;
}

/**
 * Writes the shipped tenant catalog `tenants.db` from the warehouse alone. It
 * holds every `listPublishable` tenant plus every sandbox tenant, and the
 * publish is recorded for the status history.
 *
 * @returns The number of tenant rows written.
 * @example
 * const { rowCount } = await publish(db, 'libs/tenant-db/data/tenants.db');
 */
export async function publish(
  db: Warehouse,
  artifactPath: string,
): Promise<PublishResult> {
  const artifact = await buildArtifact(db, artifactPath);
  await publications.record(db, new Date().toISOString(), artifact.rowCount);

  console.log(`wrote ${artifactPath}: ${artifact.rowCount} rows`);
  return { rowCount: artifact.rowCount };
}
