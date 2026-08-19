import { RxDatabase } from 'rxdb';
import { DatabaseCollections } from '../../../app/providers/DatabaseCollections';
import {
  ClinicalDocument,
  CreateClinicalDocument,
} from '../../../models/clinical-document/ClinicalDocument.type';

export type FhirBundleEntry = { resource?: { resourceType: string } };

export type ResourceMapper<E, C> = (
  entry: E,
  connection: C,
) => CreateClinicalDocument<E>;

export async function upsertEntries<E extends FhirBundleEntry, C>(
  db: RxDatabase<DatabaseCollections>,
  entries: E[],
  resourceType: string,
  mapper: ResourceMapper<E, C>,
  connection: C,
) {
  const cds = entries
    .filter(
      (i) =>
        i.resource?.resourceType.toLowerCase() === resourceType.toLowerCase(),
    )
    .map((entry) => mapper(entry, connection));

  return db.clinical_documents.bulkUpsert(cds as unknown as ClinicalDocument[]);
}

export async function upsertIncludedEntries<E extends FhirBundleEntry, C>(
  db: RxDatabase<DatabaseCollections>,
  entries: E[],
  mappers: Record<string, ResourceMapper<E, C>>,
  connection: C,
  searchedResourceType: string,
) {
  const groups = new Map<string, E[]>();
  for (const entry of entries) {
    const resourceType = entry.resource?.resourceType;
    if (resourceType && resourceType !== searchedResourceType) {
      const group = groups.get(resourceType);
      if (group) {
        group.push(entry);
      } else {
        groups.set(resourceType, [entry]);
      }
    }
  }

  for (const [resourceType, grouped] of groups.entries()) {
    const mapper = mappers[resourceType];
    if (mapper) {
      const cds = grouped.map((entry) => mapper(entry, connection));
      await db.clinical_documents.bulkUpsert(
        cds as unknown as ClinicalDocument[],
      );
    }
  }
}
