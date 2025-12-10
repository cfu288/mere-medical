import { RxDocument, RxDatabase } from 'rxdb';
import { DatabaseCollections } from '../../app/providers/DatabaseCollections';
import { ConnectionDocument } from '../../models/connection-document/ConnectionDocument.type';
import * as connectionRepo from '../../repositories/ConnectionRepository';

export async function getConnectionCardByUrl<T extends ConnectionDocument>(
  url: string,
  db: RxDatabase<DatabaseCollections>,
  userId: string,
): Promise<RxDocument<T> | null> {
  const connection = await connectionRepo.findConnectionByUrl(db, userId, url);
  if (!connection) {
    return null;
  }

  const result = await connectionRepo.findConnectionWithDoc(
    db,
    userId,
    connection.id,
  );
  return result.rawConnection as unknown as RxDocument<T>;
}
