import { useCallback, useEffect, useState } from 'react';
import { RxDatabase, RxDocument } from 'rxdb';
import { ConnectionDocument } from '../../models/connection-document/ConnectionDocument.type';
import { useRxDb } from '../providers/RxDbProvider';
import { DatabaseCollections } from '../providers/DatabaseCollections';
import { useUser } from '../providers/UserProvider';

export function useConnectionDoc(id: string) {
  const db = useRxDb(),
    user = useUser(),
    [conn, setConn] = useState<RxDocument<ConnectionDocument>>(),
    getList = useCallback(() => {
      if (user) {
        getConnectionCardById(id, db, user.id).then((list) => {
          setConn(list as unknown as RxDocument<ConnectionDocument>);
        });
      }
    }, [db, id, user]);

  useEffect(() => {
    getList();
  }, [getList]);

  return conn;
}

export function useConnectionDocs(ids: string[]) {
  const db = useRxDb(),
    user = useUser(),
    [conns, setConns] = useState<RxDocument<ConnectionDocument>[]>([]),
    idsSerialized = JSON.stringify(ids),
    getList = useCallback(() => {
      if (user) {
        getConnectionCardsByIds(ids, db, user.id).then((list) => {
          setConns(list as unknown as RxDocument<ConnectionDocument>[]);
        });
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [db, idsSerialized, user]);

  useEffect(() => {
    getList();
  }, [getList]);

  return conns;
}

export async function getConnectionCardsByIds(
  ids: string[],
  db: RxDatabase<DatabaseCollections>,
  userId: string,
) {
  return db.connection_documents
    .find({
      selector: {
        id: {
          $in: ids,
        },
        user_id: userId,
      },
    })
    .exec()
    .then((list) => list as unknown as RxDocument<ConnectionDocument>[]);
}

export async function getConnectionCardById(
  id: string,
  db: RxDatabase<DatabaseCollections>,
  userId: string,
) {
  return db.connection_documents
    .findOne({
      selector: {
        id: id,
        user_id: userId,
      },
    })
    .exec()
    .then((list) => list as unknown as RxDocument<ConnectionDocument>);
}
