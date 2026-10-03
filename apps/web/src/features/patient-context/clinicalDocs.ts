import { BundleEntry, FhirResource } from 'fhir/r2';
import { RxDatabase, RxDocument } from 'rxdb';

import { DatabaseCollections } from '../../app/providers/DatabaseCollections';
import { findAllConnections } from '../../repositories/ConnectionRepository';
import {
  ClinicalDocument,
  ClinicalDocumentResourceType,
} from '../../models/clinical-document/ClinicalDocument.type';

export type ClinicalDoc = ClinicalDocument<BundleEntry<FhirResource>>;

export type ClinicalDocStore = {
  docs: ClinicalDoc[];
  connectionLocations: Map<string, string>;
};

export async function loadClinicalDocs(
  db: RxDatabase<DatabaseCollections>,
  userId: string,
): Promise<ClinicalDocStore> {
  const [docs, connections] = await Promise.all([
    db.clinical_documents.find({ selector: { user_id: userId } }).exec(),
    findAllConnections(db, userId),
  ]);
  const connectionLocations = new Map<string, string>();
  for (const connection of connections) {
    if (typeof connection.location === 'string') {
      connectionLocations.set(connection.id, connection.location);
    }
  }
  return {
    docs: (docs as unknown as RxDocument<ClinicalDoc>[]).map((doc) =>
      doc.toMutableJSON(),
    ),
    connectionLocations,
  };
}

export function docsByType(
  docs: ClinicalDoc[],
): Map<ClinicalDocumentResourceType, ClinicalDoc[]> {
  const byType = new Map<ClinicalDocumentResourceType, ClinicalDoc[]>();
  for (const doc of docs) {
    const group = byType.get(doc.data_record.resource_type);
    if (group) {
      group.push(doc);
    } else {
      byType.set(doc.data_record.resource_type, [doc]);
    }
  }
  return byType;
}
