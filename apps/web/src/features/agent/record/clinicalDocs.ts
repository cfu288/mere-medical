import { BundleEntry, FhirResource } from 'fhir/r2';
import { RxDatabase } from 'rxdb';

import { DatabaseCollections } from '../../../app/providers/DatabaseCollections';
import { findAllDocuments } from '../../../repositories/ClinicalDocumentRepository';
import { findAllConnections } from '../../../repositories/ConnectionRepository';
import { groupBy } from '../../../shared/utils/groupBy';
import {
  ClinicalDocument,
  ClinicalDocumentResourceType,
} from '../../../models/clinical-document/ClinicalDocument.type';

export type ClinicalDoc = ClinicalDocument<BundleEntry<FhirResource>>;

export type ByType = Map<ClinicalDocumentResourceType, ClinicalDoc[]>;

export type ClinicalDocStore = {
  docs: ClinicalDoc[];
  connectionLocations: Map<string, string>;
};

export async function loadClinicalDocs(
  db: RxDatabase<DatabaseCollections>,
  userId: string,
): Promise<ClinicalDocStore> {
  const [docs, connections] = await Promise.all([
    findAllDocuments<BundleEntry<FhirResource>>(db, userId),
    findAllConnections(db, userId),
  ]);
  const connectionLocations = new Map<string, string>();
  for (const connection of connections) {
    if (typeof connection.location === 'string') {
      connectionLocations.set(connection.id, connection.location);
    }
  }
  return { docs, connectionLocations };
}

export function docsByType(docs: ClinicalDoc[]): ByType {
  return groupBy(docs, (doc) => doc.data_record.resource_type);
}
