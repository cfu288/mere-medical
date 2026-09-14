/**
 * Owns the `fetch_runs` table, one row per finished extract run with its failure
 * count. Extract records a row when a run ends and status reads the last two per
 * vendor and version to render the failing column and its delta.
 */
import type { FhirVersion, Vendor } from '@mere/shared';
import type { Warehouse } from '../open';

/** Saves a finished extract run's failure count for the status deltas. */
export async function record(
  db: Warehouse,
  vendor: Vendor,
  fhirVersion: FhirVersion,
  failed: number,
): Promise<void> {
  await db
    .insertInto('fetch_runs')
    .values({ vendor, fhir_version: fhirVersion, failed })
    .execute();
}

/** The failed counts of the last two finished runs, newest first. */
export async function lastTwoFailedCounts(
  db: Warehouse,
  vendor: Vendor,
  fhirVersion: FhirVersion,
): Promise<number[]> {
  const rows = await db
    .selectFrom('fetch_runs')
    .select('failed')
    .where('vendor', '=', vendor)
    .where('fhir_version', '=', fhirVersion)
    .orderBy('id', 'desc')
    .limit(2)
    .execute();
  return rows.map((row) => row.failed);
}
