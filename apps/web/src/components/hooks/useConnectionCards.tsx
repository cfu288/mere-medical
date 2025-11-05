import { useEffect, useState } from 'react';
import { ConnectionDocument } from '../../models/connection-document/ConnectionDocument.type';
import { RxDocument } from 'rxdb';
import { useUser } from '../providers/UserProvider';
import { useConnectionRepository } from '../../repositories/hooks/useConnectionRepository';

/**
 * Returns a subscription to a list of all the connection cards
 * @returns Array of RxDocument<ConnectionDocument>[]
 */
export function useConnectionCards() {
  const connectionRepo = useConnectionRepository();
  const user = useUser();
  const [list, setList] = useState<RxDocument<ConnectionDocument>[]>();

  useEffect(() => {
    if (!connectionRepo || !user?.id) return;

    const sub = connectionRepo.watchAll(user.id).subscribe(setList);
    return () => sub.unsubscribe();
  }, [connectionRepo, user?.id]);

  return list;
}
