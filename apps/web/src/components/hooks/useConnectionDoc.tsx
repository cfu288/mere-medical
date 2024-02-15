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

export function useConnectionDocs(ids: string[]) {
  const db = useRxDb(),
    [conns, setConns] = useState<RxDocument<ConnectionDocument>[]>([]),
    idsSerialized = JSON.stringify(ids),
    getList = useCallback(() => {
      getConnectionCardsByIds(ids, db).then((list) => {
        setConns(list as unknown as RxDocument<ConnectionDocument>[]);
      });
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [db, idsSerialized]);

  useEffect(() => {
    getList();
  }, [getList]);

  return conns;
}

export async function getConnectionCardsByIds(
  ids: string[],
  db: RxDatabase<DatabaseCollections>,
) {
  return db.connection_documents
    .find({
      selector: {
        id: {
          $in: ids,
        },
      },
    })
    .exec()
    .then((list) => list as unknown as RxDocument<ConnectionDocument>[]);
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
