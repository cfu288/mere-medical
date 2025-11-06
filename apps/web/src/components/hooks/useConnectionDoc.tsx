import { useEffect, useState } from 'react';
import { RxDocument } from 'rxdb';
import { ConnectionDocument } from '../../models/connection-document/ConnectionDocument.type';
import { useUser } from '../providers/UserProvider';
import { useConnectionRepository } from '../../repositories/hooks/useConnectionRepository';

export function useConnectionDoc(id: string) {
  const connectionRepository = useConnectionRepository();
  const user = useUser();
  const [conn, setConn] = useState<RxDocument<ConnectionDocument>>();

  const userId = user?.id;
  useEffect(() => {
    let cancelled = false;

    const fetchConn = async () => {
      if (userId && connectionRepository) {
        try {
          const result = await connectionRepository.findWithDoc(userId, id);
          if (!cancelled && result.rawConnection) {
            setConn(result.rawConnection);
          }
        } catch (error) {
          console.error('Failed to fetch connection:', error);
          if (!cancelled) {
            setConn(undefined);
          }
        }
      }
    };

    fetchConn();

    return () => {
      cancelled = true;
    };
  }, [connectionRepository, id, userId]);

  return conn;
}

export function useConnectionDocs(ids: string[]) {
  const connectionRepository = useConnectionRepository();
  const user = useUser();
  const [conns, setConns] = useState<RxDocument<ConnectionDocument>[]>([]);
  const idsSerialized = JSON.stringify(ids);

  useEffect(() => {
    let cancelled = false;

    const fetchConns = async () => {
      if (user?.id && connectionRepository) {
        try {
          const results = await connectionRepository.findWithDocsByIds(
            user.id,
            ids,
          );
          if (!cancelled) {
            setConns(results.map((result) => result.rawConnection));
          }
        } catch (error) {
          console.error('Failed to fetch connections:', error);
          if (!cancelled) {
            setConns([]);
          }
        }
      }
    };

    fetchConns();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectionRepository, idsSerialized, user?.id]);

  return conns;
}
