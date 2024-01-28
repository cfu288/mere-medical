import { useCallback, useEffect, useState } from 'react';
import { RxDatabase, RxDocument } from 'rxdb';
import { ConnectionDocument } from '../../models/connection-document/ConnectionDocument.type';
import { useRxDb } from '../providers/RxDbProvider';
import { DatabaseCollections } from '../providers/DatabaseCollections';

export function useConnectionDoc(id: string) {
  const db = useRxDb(),
    [conn, setConn] = useState<RxDocument<ConnectionDocument>>(),
    getList = useCallback(() => {
      getConnectionCardById(id, db).then((list) => {
        setConn(list as unknown as RxDocument<ConnectionDocument>);
      });
    }, [db, id]);

  useEffect(() => {
    getList();
  }, [getList]);

  return conn;
}

export async function getConnectionCardById(
  id: string,
  db: RxDatabase<DatabaseCollections>,
) {
  return db.connection_documents
    .findOne({
      selector: {
        id: id,
      },
    })
    .exec()
    .then((list) => list as unknown as RxDocument<ConnectionDocument>);
}
