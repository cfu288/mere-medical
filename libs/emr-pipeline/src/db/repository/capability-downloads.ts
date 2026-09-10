/**
 * The `capability_downloads` table: every CapabilityStatement url a directory ever
 * listed, with its last good body and last attempt. Extract registers urls and records
 * each fetch outcome; transform reads the stored bodies to classify auth urls; status
 * reads the newest download date. Durable so an outage costs freshness, never data.
 */
import type { DatabaseSync } from 'node:sqlite';
import type { FhirVersion, Vendor } from '@mere/shared';
import { allRows, getRow } from '@mere/tenant-db';

interface CapabilityKey {
  vendor: Vendor;
  fhirVersion: FhirVersion;
  url: string;
}

/** One tenant's CapabilityStatement url; body and download date arrive together once a fetch succeeds. */
export type CapabilityDownload = CapabilityKey &
  (
    | { id: number; body: string; downloadedAt: string }
    | { id: number; body: null; downloadedAt: null }
  );

interface CapabilitySqlRow {
  id: number;
  vendor: string;
  fhir_version: string;
  url: string;
  body: string | null;
  downloaded_at: string | null;
}

function toRow(row: CapabilitySqlRow): CapabilityDownload {
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

/** Registers a url for download; a url already present keeps its stored body and dates. */
export function addUrl(db: DatabaseSync, key: CapabilityKey): void {
  db.prepare(
    `INSERT INTO capability_downloads (vendor, fhir_version, url)
     VALUES (?, ?, ?)
     ON CONFLICT (vendor, fhir_version, url) DO NOTHING`,
  ).run(key.vendor, key.fhirVersion, key.url);
}

export function findByUrl(
  db: DatabaseSync,
  key: CapabilityKey,
): CapabilityDownload | null {
  const row = getRow<CapabilitySqlRow>(
    db.prepare(
      `SELECT * FROM capability_downloads
       WHERE vendor = ? AND fhir_version = ? AND url = ?`,
    ),
    [key.vendor, key.fhirVersion, key.url],
  );
  return row ? toRow(row) : null;
}

export function findById(
  db: DatabaseSync,
  id: number,
): CapabilityDownload | null {
  const row = getRow<CapabilitySqlRow>(
    db.prepare('SELECT * FROM capability_downloads WHERE id = ?'),
    [id],
  );
  return row ? toRow(row) : null;
}

interface DownloadSuccess {
  id: number;
  body: string;
  now: string;
}

/** Stores a fetched body with its date and clears any earlier failure. */
export function recordSuccess(db: DatabaseSync, result: DownloadSuccess): void {
  db.prepare(
    `UPDATE capability_downloads
     SET body          = :body,
         downloaded_at = :now,
         attempted_at  = :now,
         failed        = 0,
         error         = NULL
     WHERE id = :id`,
  ).run({
    id: result.id,
    body: result.body,
    now: result.now,
  });
}

interface DownloadFailure {
  id: number;
  error: unknown;
  now: string;
}

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

/** Records a failed fetch: attempt date and error only, never `body`, so the last good copy survives an outage. */
export function recordFailure(
  db: DatabaseSync,
  failure: DownloadFailure,
): void {
  db.prepare(
    `UPDATE capability_downloads
     SET attempted_at = :now,
         failed       = 1,
         error        = :error
     WHERE id = :id`,
  ).run({
    id: failure.id,
    now: failure.now,
    error: serializeError(failure.error),
  });
}

export function latestDownloadedAt(
  db: DatabaseSync,
  vendor: Vendor,
  fhirVersion: FhirVersion,
): string | null {
  return (
    getRow<{ newest: string | null }>(
      db.prepare(
        `SELECT MAX(downloaded_at) AS newest FROM capability_downloads
         WHERE vendor = ? AND fhir_version = ?`,
      ),
      [vendor, fhirVersion],
    )?.newest ?? null
  );
}

interface DownloadListQuery {
  vendor: Vendor;
  fhirVersion: FhirVersion;
}

/** Every url for one vendor and version, never-downloaded first; each run refetches all. */
export function selectForDownload(
  db: DatabaseSync,
  query: DownloadListQuery,
): CapabilityDownload[] {
  const rows = allRows<CapabilitySqlRow>(
    db.prepare(
      `SELECT * FROM capability_downloads
       WHERE vendor = :vendor AND fhir_version = :fhirVersion
       ORDER BY (body IS NULL) DESC, downloaded_at ASC`,
    ),
    {
      vendor: query.vendor,
      fhirVersion: query.fhirVersion,
    },
  );
  return rows.map(toRow);
}
