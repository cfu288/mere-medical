import { RxDatabase } from 'rxdb';
import { DatabaseCollections } from '../components/providers/DatabaseCollections';
import * as connectionRepo from '../repositories/ConnectionRepository';
import * as clinicalDocRepo from '../repositories/ClinicalDocumentRepository';

export async function deleteConnectionWithCascade(
  db: RxDatabase<DatabaseCollections>,
  userId: string,
  connectionId: string,
): Promise<void> {
  const connection = await connectionRepo.findConnectionById(
    db,
    userId,
    connectionId,
  );

  if (!connection) {
    return;
  }

  await clinicalDocRepo.deleteDocumentsByConnectionId(db, userId, connectionId);

  await connectionRepo.deleteConnection(db, userId, connectionId);
}
