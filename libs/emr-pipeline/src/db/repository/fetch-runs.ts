import type { DatabaseSync } from 'node:sqlite';
import type { FhirVersion, Vendor } from '@mere/shared';

export function startRun(
  db: DatabaseSync,
  vendor: Vendor,
  fhirVersion: FhirVersion,
): number {
  const result = db
    .prepare(
      `INSERT INTO fetch_runs (vendor, fhir_version, status)
       VALUES (?, ?, 'running')`,
    )
    .run(vendor, fhirVersion);
  return Number(result.lastInsertRowid);
}

export function finishRun(
  db: DatabaseSync,
  runId: number,
  failed: number,
): void {
  db.prepare(
    `UPDATE fetch_runs SET status = 'done', failed = ? WHERE id = ?`,
  ).run(failed, runId);
}
