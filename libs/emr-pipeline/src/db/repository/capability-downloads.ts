/**
 * Owns `capability_downloads`, every CapabilityStatement url a directory ever
 * listed with its last good body and last attempt. Extract writes it, transform
 * reads the bodies, status reads the dates.
 */
import { sql } from 'kysely';
import type { Selectable } from 'kysely';
import type { FhirVersion, Vendor } from '@mere/shared';
import type { Warehouse } from '../open';
import { insertChunked } from '../insert-chunked';
import type { CapabilityDownloadsTable } from '../warehouse-schema';

interface CapabilityKey {
  vendor: Vendor;
  fhirVersion: FhirVersion;
  url: string;
}

/**
 * One tenant's CapabilityStatement url. Body and download date arrive together
 * once a fetch succeeds.
 */
export type CapabilityDownload = CapabilityKey &
  (
    | { id: number; body: string; downloadedAt: string }
    | { id: number; body: null; downloadedAt: null }
  );

function toRow(row: Selectable<CapabilityDownloadsTable>): CapabilityDownload {
  const key = {
    id: row.id,
    vendor: row.vendor as Vendor,
    fhirVersion: row.fhir_version as FhirVersion,
    url: row.url,
  };
  if (row.body === null || row.downloaded_at === null) {
    return { ...key, body: null, downloadedAt: null };
  }
  return { ...key, body: row.body, downloadedAt: row.downloaded_at };
}

/**
 * Registers a url for download. A url already present keeps its stored body and
 * dates.
 */
export async function addUrl(db: Warehouse, key: CapabilityKey): Promise<void> {
  await addUrls(db, key.vendor, key.fhirVersion, [key.url]);
}

/** Registers many urls at once, in batches. Urls already present keep their stored bodies and dates. */
export async function addUrls(
  db: Warehouse,
  vendor: Vendor,
  fhirVersion: FhirVersion,
  urls: string[],
): Promise<void> {
  await insertChunked(
    urls.map((url) => ({ vendor, fhir_version: fhirVersion, url })),
    (chunk) =>
      db
        .insertInto('capability_downloads')
        .values(chunk)
        .onConflict((oc) =>
          oc.columns(['vendor', 'fhir_version', 'url']).doNothing(),
        )
        .execute(),
  );
}

export async function findByUrl(
  db: Warehouse,
  key: CapabilityKey,
): Promise<CapabilityDownload | null> {
  const row = await db
    .selectFrom('capability_downloads')
    .selectAll()
    .where('vendor', '=', key.vendor)
    .where('fhir_version', '=', key.fhirVersion)
    .where('url', '=', key.url)
    .executeTakeFirst();
  return row ? toRow(row) : null;
}

export async function findById(
  db: Warehouse,
  id: number,
): Promise<CapabilityDownload | null> {
  const row = await db
    .selectFrom('capability_downloads')
    .selectAll()
    .where('id', '=', id)
    .executeTakeFirst();
  return row ? toRow(row) : null;
}

interface DownloadSuccess {
  id: number;
  body: string;
  now: string;
}

/**
 * Stores a fetched body with its download and attempt dates and clears any
 * earlier failure.
 */
export async function recordSuccess(
  db: Warehouse,
  result: DownloadSuccess,
): Promise<void> {
  await db
    .updateTable('capability_downloads')
    .set({
      body: result.body,
      downloaded_at: result.now,
      attempted_at: result.now,
      failed: 0,
      error: null,
    })
    .where('id', '=', result.id)
    .execute();
}

interface DownloadFailure {
  id: number;
  error: unknown;
  now: string;
}

/** Flattens any thrown value to JSON for the error column. */
function serializeError(error: unknown): string {
  if (error instanceof Error) {
    return JSON.stringify({
      name: error.name,
      message: error.message,
      stack: error.stack,
    });
  }
  return JSON.stringify({ name: 'Unknown', message: String(error) });
}

/**
 * Records a failed fetch as an attempt date and error. It never touches the
 * body, so the last good copy survives an outage.
 */
export async function recordFailure(
  db: Warehouse,
  failure: DownloadFailure,
): Promise<void> {
  await db
    .updateTable('capability_downloads')
    .set({
      attempted_at: failure.now,
      failed: 1,
      error: serializeError(failure.error),
    })
    .where('id', '=', failure.id)
    .execute();
}

/** The newest successful download date, shown by status as the crawl age. */
export async function latestDownloadedAt(
  db: Warehouse,
  vendor: Vendor,
  fhirVersion: FhirVersion,
): Promise<string | null> {
  const row = await db
    .selectFrom('capability_downloads')
    .select((eb) => eb.fn.max('downloaded_at').as('newest'))
    .where('vendor', '=', vendor)
    .where('fhir_version', '=', fhirVersion)
    .executeTakeFirst();
  return row?.newest ?? null;
}

/**
 * Every url for one vendor and version, never-downloaded first. Each run
 * refetches all of them.
 */
export async function selectForDownload(
  db: Warehouse,
  vendor: Vendor,
  fhirVersion: FhirVersion,
): Promise<CapabilityDownload[]> {
  const rows = await db
    .selectFrom('capability_downloads')
    .selectAll()
    .where('vendor', '=', vendor)
    .where('fhir_version', '=', fhirVersion)
    .orderBy((eb) => eb('body', 'is', null), 'desc')
    .orderBy('downloaded_at', 'asc')
    .execute();
  return rows.map(toRow);
}

/** The most common failure messages for a vendor and version, for the status report. */
export async function topFailureMessages(
  db: Warehouse,
  vendor: Vendor,
  fhirVersion: FhirVersion,
  limit: number,
): Promise<{ message: string; count: number }[]> {
  return db
    .selectFrom('capability_downloads')
    .select((eb) => [
      sql<string>`coalesce(json_extract(error, '$.message'), error)`.as(
        'message',
      ),
      eb.fn.countAll<number>().as('count'),
    ])
    .where('vendor', '=', vendor)
    .where('fhir_version', '=', fhirVersion)
    .where('failed', '=', 1)
    .groupBy('message')
    .orderBy('count', 'desc')
    .limit(limit)
    .execute();
}
