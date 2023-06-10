import { useCallback, useEffect, useState } from 'react';
import { RxDatabase, RxDocument } from 'rxdb';
import { ConnectionDocument } from '../../models/connection-document/ConnectionDocument.type';
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
        id: id,
      },
    })
    .exec()
    .then((list) => list as unknown as RxDocument<ConnectionDocument>);
}

export function useAllConnectionDocs() {
  const db = useRxDb(),
    [conn, setConn] = useState<RxDocument<ConnectionDocument>[]>(),
    getList = useCallback(() => {
      getAllConnectionCards(db).then((list) => {
        setConn(list as unknown as RxDocument<ConnectionDocument>[]);
      });
    }, [db]);

  useEffect(() => {
    getList();
  }, [getList]);

  return conn;
}

async function getAllConnectionCards(db: RxDatabase<DatabaseCollections>) {
  return db.connection_documents
    .find()
    .exec()
    .then((list) => list as unknown as RxDocument<ConnectionDocument>[]);
}
