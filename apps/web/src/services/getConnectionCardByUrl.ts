import { RxDocument, RxDatabase } from 'rxdb';
import { DatabaseCollections } from '../components/providers/DatabaseCollections';
import { ConnectionDocument } from '../models/connection-document/ConnectionDocument.type';

export async function getConnectionCardByUrl<T extends ConnectionDocument>(
  url: string,
  db: RxDatabase<DatabaseCollections>,
  userId: string,
): Promise<RxDocument<T>> {
  return db.connection_documents
    .findOne({
      selector: {
        location: url,
        user_id: userId,
      },
    })
    .exec()
    .then((list) => list as unknown as RxDocument<T>);
}
