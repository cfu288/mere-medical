import type { DatabaseSync } from 'node:sqlite';
import type { FhirVersion, Vendor } from '@mere/shared';
import { allRows, getRow } from '@mere/tenant-db';

export interface Snapshot {
  fetched_at: string;
  body: string;
}

/** Appends a directory body; an unchanged body just advances the latest snapshot's time. */
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
