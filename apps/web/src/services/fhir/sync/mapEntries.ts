import { CreateClinicalDocument } from '../../../models/clinical-document/ClinicalDocument.type';

export type FhirBundleEntry = { resource?: { resourceType: string } };

export type ResourceMapper<E, C> = (
  entry: E,
  connection: C,
) => CreateClinicalDocument<E>;

export function mapEntries<E extends FhirBundleEntry, C>(
  entries: E[],
  resourceType: string,
  mapper: ResourceMapper<E, C>,
  connection: C,
): CreateClinicalDocument<E>[] {
  return entries
    .filter(
      (i) =>
        i.resource?.resourceType.toLowerCase() === resourceType.toLowerCase(),
    )
    .map((entry) => mapper(entry, connection));
}

export function mapCompanionResources<E extends FhirBundleEntry, C>(
  entries: E[],
  mappers: Record<string, ResourceMapper<E, C>>,
  connection: C,
  searchedResourceType: string,
): CreateClinicalDocument<E>[] {
  const documents: CreateClinicalDocument<E>[] = [];
  for (const entry of entries) {
    const resourceType = entry.resource?.resourceType;
    if (!resourceType || resourceType === searchedResourceType) continue;
    const mapper = mappers[resourceType];
    if (mapper) {
      documents.push(mapper(entry, connection));
    }
  }
  return documents;
}
