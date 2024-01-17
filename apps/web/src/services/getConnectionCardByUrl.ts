import { RxDocument, RxDatabase } from 'rxdb';
import { DatabaseCollections } from '../components/providers/DatabaseCollections';
import { ConnectionDocument } from '../models/connection-document/ConnectionDocument.type';

export async function getConnectionCardByUrl<T extends ConnectionDocument>(
  url: string | Location,
  db: RxDatabase<DatabaseCollections>,
): Promise<RxDocument<T>> {
  return db.connection_documents
    .findOne({
      selector: { location: url },
    })
    .exec()
    .then((list) => list as unknown as RxDocument<T>);
}
