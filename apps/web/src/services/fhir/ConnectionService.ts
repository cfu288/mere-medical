import { RxDatabase } from 'rxdb';
import { DatabaseCollections } from '../../app/providers/DatabaseCollections';
import * as connectionRepo from '../../repositories/ConnectionRepository';
import * as clinicalDocRepo from '../../repositories/ClinicalDocumentRepository';

export async function deleteConnectionWithCascade(
  db: RxDatabase<DatabaseCollections>,
  userId: string,
  connectionId: string,
): Promise<void> {
  const connection = await connectionRepo.findConnectionById(
    db,
    userId,
    connectionId,
  );

  if (!connection) {
    return;
  }

  await connectionRepo.deleteConnection(db, userId, connectionId);

  await clinicalDocRepo.deleteDocumentsByConnectionId(db, userId, connectionId);
}

export async function recordSyncSuccess(
  db: RxDatabase<DatabaseCollections>,
  userId: string,
  connectionId: string,
): Promise<void> {
  const connection = await connectionRepo.findConnectionById(
    db,
    userId,
    connectionId,
  );
  if (!connection) {
    return;
  }

  const now = new Date().toISOString();
  await connectionRepo.updateConnectionTimestamp(db, userId, connectionId, {
    last_refreshed: now,
    last_sync_attempt: now,
    last_sync_was_error: false,
  });
}

export async function recordSyncError(
  db: RxDatabase<DatabaseCollections>,
  userId: string,
  connectionId: string,
): Promise<void> {
  const connection = await connectionRepo.findConnectionById(
    db,
    userId,
    connectionId,
  );
  if (!connection) {
    return;
  }

  await connectionRepo.updateConnectionTimestamp(db, userId, connectionId, {
    last_sync_attempt: new Date().toISOString(),
    last_sync_was_error: true,
  });
}

export async function clearSyncError(
  db: RxDatabase<DatabaseCollections>,
  userId: string,
  connectionId: string,
): Promise<void> {
  const connection = await connectionRepo.findConnectionById(
    db,
    userId,
    connectionId,
  );
  if (!connection) {
    return;
  }

  await connectionRepo.updateConnectionTimestamp(db, userId, connectionId, {
    last_sync_was_error: false,
  });
}
