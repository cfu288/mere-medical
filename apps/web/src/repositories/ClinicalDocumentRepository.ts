import { RxDatabase } from 'rxdb';
import { DatabaseCollections } from '../app/providers/DatabaseCollections';
import {
  ClinicalDocument,
  ClinicalDocumentResourceType,
  CreateClinicalDocument,
} from '../models/clinical-document/ClinicalDocument.type';

export async function deleteDocumentsByConnectionId(
  db: RxDatabase<DatabaseCollections>,
  userId: string,
  connectionId: string,
): Promise<void> {
  await db.clinical_documents
    .find({
      selector: {
        user_id: userId,
        connection_record_id: connectionId,
      },
    })
    .remove();
}

export async function bulkUpsertDocuments<T>(
  db: RxDatabase<DatabaseCollections>,
  documents: CreateClinicalDocument<T>[],
): Promise<void> {
  await db.clinical_documents.bulkUpsert(
    documents as unknown as ClinicalDocument[],
  );
}

export async function createDocument<T>(
  db: RxDatabase<DatabaseCollections>,
  document: CreateClinicalDocument<T>,
): Promise<void> {
  await db.clinical_documents.insert(
    document as unknown as ClinicalDocument<T>,
  );
}

export async function findDocumentsByResourceType<T>(
  db: RxDatabase<DatabaseCollections>,
  userId: string,
  connectionId: string,
  resourceType: ClinicalDocumentResourceType,
): Promise<ClinicalDocument<T>[]> {
  const docs = await db.clinical_documents
    .find({
      selector: {
        user_id: userId,
        'data_record.resource_type': { $eq: resourceType },
        connection_record_id: connectionId,
      },
    })
    .exec();

  return docs.map(
    (doc) => doc.toMutableJSON() as unknown as ClinicalDocument<T>,
  );
}

export async function documentExistsByMetadataId(
  db: RxDatabase<DatabaseCollections>,
  userId: string,
  connectionId: string,
  metadataId: string,
): Promise<boolean> {
  const docs = await db.clinical_documents
    .find({
      selector: {
        $and: [
          { user_id: userId },
          { 'metadata.id': metadataId },
          { connection_record_id: connectionId },
        ],
      },
    })
    .exec();

  return docs.length > 0;
}
