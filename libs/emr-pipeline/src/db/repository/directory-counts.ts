/**
 * Owns the `directory_counts` table, which keeps how many tenants each vendor's
 * directory listed when transform last parsed it. Transform records it and status
 * reads it for the endpoints column and the transform-behind flag.
 */
import type { DatabaseSync } from 'node:sqlite';
import type { FhirVersion, Vendor } from '@mere/shared';
import { getRow } from '@mere/tenant-db';

/**
 * How many tenants a vendor's directory listed the last time transform parsed
 * it.
 */
interface DirectoryCount {
  seen_at: string;
  tenant_count: number;
}

/**
 * Saves the newest directory copy's tenant count when transform finishes a
 * vendor and version.
 */
export function record(
  db: DatabaseSync,
  vendor: Vendor,
  fhirVersion: FhirVersion,
  seenAt: string,
  tenantCount: number,
): void {
  db.prepare(
    `INSERT INTO directory_counts (vendor, fhir_version, seen_at, tenant_count)
     VALUES (?, ?, ?, ?)
     ON CONFLICT (vendor, fhir_version) DO UPDATE SET
       seen_at = excluded.seen_at,
       tenant_count = excluded.tenant_count`,
  ).run(vendor, fhirVersion, seenAt, tenantCount);
}

/**
 * The saved count for one vendor and version, rendered by status as the
 * endpoints column.
 */
export function find(
  db: DatabaseSync,
  vendor: Vendor,
  fhirVersion: FhirVersion,
): DirectoryCount | null {
  return getRow<DirectoryCount>(
    db.prepare(
      `SELECT seen_at, tenant_count FROM directory_counts
       WHERE vendor = ? AND fhir_version = ?`,
    ),
    [vendor, fhirVersion],
  );
}
