import { useMemo } from 'react';
import { useRxDb } from '../../app/providers/RxDbProvider';
import * as connectionRepo from '../ConnectionRepository';
import { ConnectionDocument } from '../../models/connection-document/ConnectionDocument.type';

export const useConnectionRepository = () => {
  const db = useRxDb();

  return useMemo(() => {
    if (!db) return null;

    return {
      findById: (userId: string, connectionId: string) =>
        connectionRepo.findConnectionById(db, userId, connectionId),
      findByUrl: (userId: string, url: string | Location) =>
        connectionRepo.findConnectionByUrl(db, userId, url),
      findByIds: (userId: string, ids: string[]) =>
        connectionRepo.findConnectionsByIds(db, userId, ids),
      findAll: (userId: string) =>
        connectionRepo.findAllConnections(db, userId),
      findWithDoc: (userId: string, connectionId: string) =>
        connectionRepo.findConnectionWithDoc(db, userId, connectionId),
      findWithDocsByIds: (userId: string, ids: string[]) =>
        connectionRepo.findConnectionsWithDocsByIds(db, userId, ids),
      watchAll: (userId: string) =>
        connectionRepo.watchAllConnections(db, userId),
      watchCount: (userId: string) =>
        connectionRepo.watchConnectionCount(db, userId),
      create: (connectionData: ConnectionDocument) =>
        connectionRepo.createConnection(db, connectionData),
      update: (
        userId: string,
        connectionId: string,
        updates: Partial<ConnectionDocument>,
      ) => connectionRepo.updateConnection(db, userId, connectionId, updates),
      updateToken: (
        userId: string,
        connectionId: string,
        tokenData: {
          access_token: string;
          expires_at?: number;
          expires_in?: number;
          scope?: string;
          refresh_token?: string;
          id_token?: string;
        },
      ) =>
        connectionRepo.updateConnectionToken(
          db,
          userId,
          connectionId,
          tokenData,
        ),
      updateTimestamp: (
        userId: string,
        connectionId: string,
        timestampData: {
          last_refreshed?: string;
          last_sync_attempt?: string;
          last_sync_was_error?: boolean;
        },
      ) =>
        connectionRepo.updateConnectionTimestamp(
          db,
          userId,
          connectionId,
          timestampData,
        ),
      upsert: (userId: string, connectionData: ConnectionDocument) =>
        connectionRepo.upsertConnection(db, userId, connectionData),
      delete: (userId: string, connectionId: string) =>
        connectionRepo.deleteConnection(db, userId, connectionId),
    };
  }, [db]);
};
