/**
 * Owns the `directory_counts` table, which keeps how many tenants each vendor's
 * directory listed when transform last parsed it. Transform records it and status
 * reads it for the endpoints column and the transform-behind flag.
 */
import type { Selectable } from 'kysely';
import type { FhirVersion, Vendor } from '@mere/shared';
import type { DirectoryCountsTable } from '../warehouse-schema';
import type { Warehouse } from '../open';

/**
 * How many tenants a vendor's directory listed the last time transform parsed
 * it.
 */
type DirectoryCount = Pick<
  Selectable<DirectoryCountsTable>,
  'seen_at' | 'tenant_count'
>;

/**
 * Saves the newest snapshot's tenant count when transform finishes a
 * vendor and version.
 */
export async function record(
  db: Warehouse,
  vendor: Vendor,
  fhirVersion: FhirVersion,
  seenAt: string,
  tenantCount: number,
): Promise<void> {
  await db
    .insertInto('directory_counts')
    .values({
      vendor,
      fhir_version: fhirVersion,
      seen_at: seenAt,
      tenant_count: tenantCount,
    })
    .onConflict((oc) =>
      oc.columns(['vendor', 'fhir_version']).doUpdateSet({
        seen_at: seenAt,
        tenant_count: tenantCount,
      }),
    )
    .execute();
}

/**
 * The saved count for one vendor and version, rendered by status as the
 * endpoints column.
 */
export async function find(
  db: Warehouse,
  vendor: Vendor,
  fhirVersion: FhirVersion,
): Promise<DirectoryCount | null> {
  const row = await db
    .selectFrom('directory_counts')
    .select(['seen_at', 'tenant_count'])
    .where('vendor', '=', vendor)
    .where('fhir_version', '=', fhirVersion)
    .executeTakeFirst();
  return row ?? null;
}
