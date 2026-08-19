import { RxDatabase } from 'rxdb';
import { DatabaseCollections } from '../../../app/providers/DatabaseCollections';
import { CreateClinicalDocument } from '../../../models/clinical-document/ClinicalDocument.type';
import { bulkUpsertDocuments } from '../../../repositories/ClinicalDocumentRepository';

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

  return bulkUpsertDocuments(db, cds);
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
      await bulkUpsertDocuments(
        db,
        grouped.map((entry) => mapper(entry, connection)),
      );
    }
  }
}
