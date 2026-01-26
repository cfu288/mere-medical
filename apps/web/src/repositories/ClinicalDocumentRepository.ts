import { RxDatabase } from 'rxdb';
import { DatabaseCollections } from '../app/providers/DatabaseCollections';

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

export async function connectionExists(
  db: RxDatabase<DatabaseCollections>,
  userId: string,
  connectionId: string,
): Promise<boolean> {
  const doc = await db.connection_documents
    .findOne({
      selector: {
        id: connectionId,
        user_id: userId,
      },
    })
    .exec();
  return doc !== null;
}

export async function deleteOrphanedDocuments(
  db: RxDatabase<DatabaseCollections>,
  userId: string,
): Promise<number> {
  const connections = await db.connection_documents
    .find({
      selector: {
        user_id: userId,
      },
    })
    .exec();

  const validConnectionIds = new Set(connections.map((c) => c.get('id')));

  const allClinicalDocs = await db.clinical_documents
    .find({
      selector: {
        user_id: userId,
      },
    })
    .exec();

  const orphanedDocs = allClinicalDocs.filter(
    (doc) => !validConnectionIds.has(doc.get('connection_record_id')),
  );

  if (orphanedDocs.length > 0) {
    await Promise.all(orphanedDocs.map((doc) => doc.remove()));
  }

  return orphanedDocs.length;
}
