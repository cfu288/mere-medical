import type { DatabaseSync } from 'node:sqlite';
import type { FhirVersion, Vendor } from '@mere/shared';
import { allRows, getRow } from '@mere/tenant-db';

interface CapabilityKey {
  vendor: Vendor;
  fhirVersion: FhirVersion;
  url: string;
}

/** One tenant's CapabilityStatement url, with the last copy downloaded or neither field. */
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

export function addUrl(
  db: DatabaseSync,
  key: CapabilityKey,
  now: string,
): number {
  db.prepare(
    `INSERT INTO capability_downloads (vendor, fhir_version, url, first_seen_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT (vendor, fhir_version, url) DO NOTHING`,
  ).run(key.vendor, key.fhirVersion, key.url, now);

  const row = getRow<{ id: number }>(
    db.prepare(
      `SELECT id FROM capability_downloads
       WHERE vendor = ? AND fhir_version = ? AND url = ?`,
    ),
    [key.vendor, key.fhirVersion, key.url],
  );

  if (!row) {
    throw new Error(`Failed to add ${key.vendor} capability url ${key.url}`);
  }
  return row.id;
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

export function serializeError(error: unknown): string {
  if (error instanceof Error) {
    return JSON.stringify({
      name: error.name,
      message: error.message,
      stack: error.stack,
    });
  }
  return JSON.stringify({ name: 'Unknown', message: String(error) });
}

/** A failure never touches `body`, so the last good copy survives an outage. */
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

export function countFailing(
  db: DatabaseSync,
  vendor: Vendor,
  fhirVersion: FhirVersion,
): number {
  return (
    getRow<{ n: number }>(
      db.prepare(
        `SELECT COUNT(*) AS n FROM capability_downloads
         WHERE vendor = ? AND fhir_version = ? AND failed = 1`,
      ),
      [vendor, fhirVersion],
    )?.n ?? 0
  );
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
