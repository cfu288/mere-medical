import type { DatabaseSync } from 'node:sqlite';
import type { FhirVersion, Vendor } from '@mere/shared';
import { allRows } from '@mere/tenant-db';

export function record(
  db: DatabaseSync,
  vendor: Vendor,
  fhirVersion: FhirVersion,
  failed: number,
): void {
  db.prepare(
    `INSERT INTO fetch_runs (vendor, fhir_version, failed)
     VALUES (?, ?, ?)`,
  ).run(vendor, fhirVersion, failed);
}

/** The failed counts of the last two finished runs, newest first. */
export function lastTwoFailedCounts(
  db: DatabaseSync,
  vendor: Vendor,
  fhirVersion: FhirVersion,
): number[] {
  return allRows<{ failed: number }>(
    db.prepare(
      `SELECT failed FROM fetch_runs
       WHERE vendor = ? AND fhir_version = ?
       ORDER BY id DESC LIMIT 2`,
    ),
    [vendor, fhirVersion],
  ).map((run) => run.failed);
}
