/**
 * Owns `vendor_tenant_directory_snapshots`, every distinct directory body ever
 * fetched, and `directory_fetches`, each vendor's last attempt and error. The
 * history is how the pipeline remembers delisted tenants.
 */
import type { Selectable } from 'kysely';
import type { VendorTenantDirectorySnapshotsTable } from '../warehouse-schema';
import type { FhirVersion, Vendor } from '@mere/shared';
import type { Warehouse } from '../open';

/**
 * One snapshot of a vendor's tenant directory, the body as downloaded and when.
 */
type VendorTenantDirectorySnapshot = Pick<
  Selectable<VendorTenantDirectorySnapshotsTable>,
  'fetched_at' | 'body'
>;

/**
 * Saves a directory snapshot and returns true. Identical bodies just move the
 * newest snapshot's date and return false.
 */
export async function saveSnapshot(
  db: Warehouse,
  vendor: Vendor,
  fhirVersion: FhirVersion,
  fetchedAt: string,
  body: string,
): Promise<boolean> {
  const newest = await db
    .selectFrom('vendor_tenant_directory_snapshots')
    .select((eb) => ['id', eb('body', '=', body).as('sameBody')])
    .where('vendor', '=', vendor)
    .where('fhir_version', '=', fhirVersion)
    .orderBy('fetched_at', 'desc')
    .limit(1)
    .executeTakeFirst();

  if (newest?.sameBody) {
    await db
      .updateTable('vendor_tenant_directory_snapshots')
      .set({ fetched_at: fetchedAt })
      .where('id', '=', newest.id)
      .execute();
    return false;
  }
  await db
    .insertInto('vendor_tenant_directory_snapshots')
    .values({ vendor, fhir_version: fhirVersion, fetched_at: fetchedAt, body })
    .execute();
  return true;
}

/**
 * Overwrites the single row holding a vendor's last directory fetch date and
 * error. Success clears the error. This row is the only record of a failed
 * fetch.
 */
export async function recordFetchAttempt(
  db: Warehouse,
  vendor: Vendor,
  fhirVersion: FhirVersion,
  attemptedAt: string,
  error: string | null,
): Promise<void> {
  await db
    .insertInto('directory_fetches')
    .values({
      vendor,
      fhir_version: fhirVersion,
      attempted_at: attemptedAt,
      error,
    })
    .onConflict((oc) =>
      oc.columns(['vendor', 'fhir_version']).doUpdateSet({
        attempted_at: attemptedAt,
        error,
      }),
    )
    .execute();
}

/** The newest snapshot date for a vendor and version. */
export async function latestFetchedAt(
  db: Warehouse,
  vendor: Vendor,
  fhirVersion: FhirVersion,
): Promise<string | null> {
  const row = await db
    .selectFrom('vendor_tenant_directory_snapshots')
    .select((eb) => eb.fn.max('fetched_at').as('newest'))
    .where('vendor', '=', vendor)
    .where('fhir_version', '=', fhirVersion)
    .executeTakeFirst();
  return row?.newest ?? null;
}

/** The newest snapshot date across every vendor, used by publish to stamp sandbox rows. */
export async function latestFetchedAtOverall(
  db: Warehouse,
): Promise<string | null> {
  const row = await db
    .selectFrom('vendor_tenant_directory_snapshots')
    .select((eb) => eb.fn.max('fetched_at').as('newest'))
    .executeTakeFirst();
  return row?.newest ?? null;
}

/** Every saved directory body for a vendor and version, oldest first. */
export async function listSnapshots(
  db: Warehouse,
  vendor: Vendor,
  fhirVersion: FhirVersion,
): Promise<VendorTenantDirectorySnapshot[]> {
  return db
    .selectFrom('vendor_tenant_directory_snapshots')
    .select(['fetched_at', 'body'])
    .where('vendor', '=', vendor)
    .where('fhir_version', '=', fhirVersion)
    .orderBy('fetched_at', 'asc')
    .execute();
}
