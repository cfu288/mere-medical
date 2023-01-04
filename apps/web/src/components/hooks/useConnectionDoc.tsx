import { useCallback, useEffect, useState } from 'react';
import { RxDatabase, RxDocument } from 'rxdb';
import { ConnectionDocument } from '../../models/connection-document/ConnectionDocument';
import { DatabaseCollections, useRxDb } from '../providers/RxDbProvider';

export function useConnectionDoc(id: string) {
  const db = useRxDb(),
    [conn, setConn] = useState<RxDocument<ConnectionDocument>>(),
    getList = useCallback(() => {
      getConnectionCards(id, db).then((list) => {
        setConn(list as unknown as RxDocument<ConnectionDocument>);
      });
    }, [db, id]);

  useEffect(() => {
    getList();
  }, [getList]);

  return conn;
}

async function getConnectionCards(
  id: string,
  db: RxDatabase<DatabaseCollections>
) {
  return db.connection_documents
    .findOne({
      selector: {
        _id: id,
      },
    })
    .exec()
    .then((list) => list as unknown as RxDocument<ConnectionDocument>);
}
