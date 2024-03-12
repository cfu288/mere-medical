import { useEffect, useState } from 'react';
import { ConnectionDocument } from '../../models/connection-document/ConnectionDocument.type';
import { useRxDb } from '../providers/RxDbProvider';
import { RxDocument } from 'rxdb';
import { useUser } from '../providers/UserProvider';

/**
 * Returns a subscription to a list of all the connection cards
 * @returns Array of RxDocument<ConnectionDocument>[]
 */
export function useConnectionCards() {
  const db = useRxDb(),
    user = useUser(),
    [list, setList] = useState<RxDocument<ConnectionDocument>[]>();

  useEffect(() => {
    const sub = db.connection_documents
      .find({
        selector: {
          user_id: user.id,
        },
      })
      .$.subscribe((list) =>
        setList(list as unknown as RxDocument<ConnectionDocument>[]),
      );
    return () => sub.unsubscribe();
  }, [db.connection_documents, user.id]);

  return list;
}
