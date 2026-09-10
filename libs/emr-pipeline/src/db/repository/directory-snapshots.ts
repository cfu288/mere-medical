/**
 * The `directory_snapshots` table (every distinct directory body ever fetched) and
 * `directory_fetches` (each vendor's last attempt and error). Extract appends after a
 * good directory fetch. Transform replays the whole history, and publish and status
 * read the newest dates. The history is how the pipeline remembers delisted tenants.
 */
import type { DatabaseSync } from 'node:sqlite';
import type { FhirVersion, Vendor } from '@mere/shared';
import { allRows, getRow } from '@mere/tenant-db';

/** One saved copy of a vendor's directory page, the body as downloaded and when. */
interface Snapshot {
  fetched_at: string;
  body: string;
}

/**
 * Saves a directory page into history. A page identical to the newest saved copy adds
 * no row and only moves that copy's date to now.
 */
export function appendSnapshot(
  db: DatabaseSync,
  vendor: Vendor,
  fhirVersion: FhirVersion,
  fetchedAt: string,
  body: string,
): boolean {
  const latest = getRow<{ id: number; same: number }>(
    db.prepare(
      `SELECT id, body = :body AS same FROM directory_snapshots
       WHERE vendor = :vendor AND fhir_version = :fhirVersion
       ORDER BY fetched_at DESC LIMIT 1`,
    ),
    { vendor, fhirVersion, body },
  );
  if (latest?.same === 1) {
    db.prepare(
      `UPDATE directory_snapshots SET fetched_at = ? WHERE id = ?`,
    ).run(fetchedAt, latest.id);
    return false;
  }
  db.prepare(
    `INSERT INTO directory_snapshots (vendor, fhir_version, fetched_at, body)
     VALUES (?, ?, ?, ?)`,
  ).run(vendor, fhirVersion, fetchedAt, body);
  return true;
}

/** Notes when a vendor's directory page was last requested, and the error if it failed. */
export function recordAttempt(
  db: DatabaseSync,
  vendor: Vendor,
  fhirVersion: FhirVersion,
  attemptedAt: string,
  error: string | null,
): void {
  db.prepare(
    `INSERT INTO directory_fetches (vendor, fhir_version, attempted_at, error)
     VALUES (?, ?, ?, ?)
     ON CONFLICT (vendor, fhir_version) DO UPDATE SET
       attempted_at = excluded.attempted_at,
       error = excluded.error`,
  ).run(vendor, fhirVersion, attemptedAt, error);
}

/** The newest snapshot date for one vendor and version, compared by status against the transform. */
export function latestFetchedAt(
  db: DatabaseSync,
  vendor: Vendor,
  fhirVersion: FhirVersion,
): string | null {
  return (
    getRow<{ newest: string | null }>(
      db.prepare(
        `SELECT MAX(fetched_at) AS newest FROM directory_snapshots
         WHERE vendor = ? AND fhir_version = ?`,
      ),
      [vendor, fhirVersion],
    )?.newest ?? null
  );
}

/** The newest snapshot date across every vendor, used by publish to stamp sandbox rows. */
export function latestFetchedAtOverall(db: DatabaseSync): string | null {
  return (
    getRow<{ newest: string | null }>(
      db.prepare('SELECT MAX(fetched_at) AS newest FROM directory_snapshots'),
    )?.newest ?? null
  );
}

/** Every saved directory body for a vendor and version, oldest first. */
export function listSnapshots(
  db: DatabaseSync,
  vendor: Vendor,
  fhirVersion: FhirVersion,
): Snapshot[] {
  return allRows<Snapshot>(
    db.prepare(
      `SELECT fetched_at, body FROM directory_snapshots
       WHERE vendor = ? AND fhir_version = ?
       ORDER BY fetched_at ASC`,
    ),
    [vendor, fhirVersion],
  );
}
