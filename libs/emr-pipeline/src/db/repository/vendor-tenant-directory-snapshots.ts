/**
 * Owns `vendor_tenant_directory_snapshots`, every distinct directory body ever
 * fetched, and `directory_fetches`, each vendor's last attempt and error. The
 * history is how the pipeline remembers delisted tenants.
 */
import type { DatabaseSync } from 'node:sqlite';
import type { FhirVersion, Vendor } from '@mere/shared';
import { allRows, getRow } from '@mere/tenant-db';

/**
 * One snapshot of a vendor's tenant directory, the body as downloaded and when.
 */
interface VendorTenantDirectorySnapshot {
  fetched_at: string;
  body: string;
}

/**
 * Saves a directory snapshot and returns true. Identical bodies just move the
 * newest snapshot's date and return false.
 */
export function saveSnapshot(
  db: DatabaseSync,
  vendor: Vendor,
  fhirVersion: FhirVersion,
  fetchedAt: string,
  body: string,
): boolean {
  const newest = getRow<{ id: number; sameBody: number }>(
    db.prepare(
      `SELECT id, body = :body AS sameBody FROM vendor_tenant_directory_snapshots
       WHERE vendor = :vendor AND fhir_version = :fhirVersion
       ORDER BY fetched_at DESC LIMIT 1`,
    ),
    { vendor, fhirVersion, body },
  );
  // If the latest copy is the same as the current verion, just update the timestamp
  if (newest?.sameBody === 1) {
    db.prepare(
      `UPDATE vendor_tenant_directory_snapshots SET fetched_at = ? WHERE id = ?`,
    ).run(fetchedAt, newest.id);
    return false;
  }
  db.prepare(
    `INSERT INTO vendor_tenant_directory_snapshots (vendor, fhir_version, fetched_at, body)
     VALUES (?, ?, ?, ?)`,
  ).run(vendor, fhirVersion, fetchedAt, body);
  return true;
}

/**
 * Overwrites the single row holding a vendor's last directory fetch date and
 * error. Success clears the error. A failed fetch leaves no snapshot, so this
 * row is its only trace.
 */
export function recordFetchAttempt(
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

/** The newest snapshot date for a vendor and version. */
export function latestFetchedAt(
  db: DatabaseSync,
  vendor: Vendor,
  fhirVersion: FhirVersion,
): string | null {
  return (
    getRow<{ newest: string | null }>(
      db.prepare(
        `SELECT MAX(fetched_at) AS newest FROM vendor_tenant_directory_snapshots
         WHERE vendor = ? AND fhir_version = ?`,
      ),
      [vendor, fhirVersion],
    )?.newest ?? null
  );
}

/**
 * The newest snapshot date across every vendor, used by publish to stamp
 * sandbox rows.
 */
export function latestFetchedAtOverall(db: DatabaseSync): string | null {
  return (
    getRow<{ newest: string | null }>(
      db.prepare(
        'SELECT MAX(fetched_at) AS newest FROM vendor_tenant_directory_snapshots',
      ),
    )?.newest ?? null
  );
}

/** Every saved directory body for a vendor and version, oldest first. */
export function listSnapshots(
  db: DatabaseSync,
  vendor: Vendor,
  fhirVersion: FhirVersion,
): VendorTenantDirectorySnapshot[] {
  return allRows<VendorTenantDirectorySnapshot>(
    db.prepare(
      `SELECT fetched_at, body FROM vendor_tenant_directory_snapshots
       WHERE vendor = ? AND fhir_version = ?
       ORDER BY fetched_at ASC`,
    ),
    [vendor, fhirVersion],
  );
}
