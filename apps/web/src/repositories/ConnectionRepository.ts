import { RxDatabase, RxDocument } from 'rxdb';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { DatabaseCollections } from '../app/providers/DatabaseCollections';
import { ConnectionDocument } from '../models/connection-document/ConnectionDocument.type';

export async function findConnectionById(
  db: RxDatabase<DatabaseCollections>,
  userId: string,
  connectionId: string,
): Promise<ConnectionDocument | null> {
  const doc = await db.connection_documents
    .findOne({
      selector: {
        id: connectionId,
      },
    })
    .exec();

  if (!doc) return null;

  if (doc.user_id !== userId) {
    throw new Error(
      `Access denied: Connection ${connectionId} belongs to different user`,
    );
  }

  return doc.toJSON();
}

export async function findConnectionByUrl(
  db: RxDatabase<DatabaseCollections>,
  userId: string,
  url: string | Location,
): Promise<ConnectionDocument | null> {
  const doc = await db.connection_documents
    .findOne({
      selector: {
        location: url,
        user_id: userId,
      },
    })
    .exec();
  return doc ? doc.toJSON() : null;
}

export async function findConnectionByTenant(
  db: RxDatabase<DatabaseCollections>,
  userId: string,
  source: string,
  tenantId: string,
  location: string,
): Promise<ConnectionDocument | null> {
  const doc = await db.connection_documents
    .findOne({
      selector: {
        user_id: userId,
        source,
        tenant_id: tenantId,
        location,
      },
    })
    .exec();
  return doc ? doc.toJSON() : null;
}

export async function findConnectionsByIds(
  db: RxDatabase<DatabaseCollections>,
  userId: string,
  ids: string[],
): Promise<ConnectionDocument[]> {
  const docs = await db.connection_documents
    .find({
      selector: {
        id: { $in: ids },
        user_id: userId,
      },
    })
    .exec();
  return docs.map((doc) => doc.toJSON());
}

export async function findAllConnections(
  db: RxDatabase<DatabaseCollections>,
  userId: string,
): Promise<ConnectionDocument[]> {
  const docs = await db.connection_documents
    .find({ selector: { user_id: userId } })
    .exec();
  return docs.map((doc) => doc.toJSON());
}

export async function findConnectionWithDoc(
  db: RxDatabase<DatabaseCollections>,
  userId: string,
  connectionId: string,
): Promise<{
  connection: ConnectionDocument | null;
  rawConnection: RxDocument<ConnectionDocument> | null;
}> {
  const rawConnection = await db.connection_documents
    .findOne({
      selector: {
        id: connectionId,
      },
    })
    .exec();

  if (!rawConnection) {
    return { connection: null, rawConnection: null };
  }

  if (rawConnection.user_id !== userId) {
    throw new Error(
      `Access denied: Connection ${connectionId} belongs to different user`,
    );
  }

  return {
    connection: rawConnection.toJSON(),
    rawConnection: rawConnection as RxDocument<ConnectionDocument>,
  };
}

export async function findConnectionsWithDocsByIds(
  db: RxDatabase<DatabaseCollections>,
  userId: string,
  ids: string[],
): Promise<
  Array<{
    connection: ConnectionDocument;
    rawConnection: RxDocument<ConnectionDocument>;
  }>
> {
  const docs = await db.connection_documents
    .find({
      selector: {
        id: { $in: ids },
        user_id: userId,
      },
    })
    .exec();

  return docs.map((doc) => ({
    connection: doc.toJSON(),
    rawConnection: doc as RxDocument<ConnectionDocument>,
  }));
}

export function watchAllConnections(
  db: RxDatabase<DatabaseCollections>,
  userId: string,
): Observable<RxDocument<ConnectionDocument>[]> {
  return db.connection_documents
    .find({ selector: { user_id: userId } })
    .$.pipe(map((docs) => docs as RxDocument<ConnectionDocument>[]));
}

export function watchConnectionCount(
  db: RxDatabase<DatabaseCollections>,
  userId: string,
): Observable<number> {
  return db.connection_documents
    .find({ selector: { user_id: userId } })
    .$.pipe(map((docs) => docs.length));
}

export async function createConnection(
  db: RxDatabase<DatabaseCollections>,
  connectionData: ConnectionDocument,
): Promise<RxDocument<ConnectionDocument>> {
  if (!connectionData.user_id) {
    throw new Error('Cannot create connection without user_id');
  }
  const doc = await db.connection_documents.insert(connectionData);
  return doc as RxDocument<ConnectionDocument>;
}

export async function updateConnection(
  db: RxDatabase<DatabaseCollections>,
  userId: string,
  connectionId: string,
  updates: Partial<ConnectionDocument>,
): Promise<void> {
  const doc = await db.connection_documents
    .findOne({
      selector: {
        id: connectionId,
      },
    })
    .exec();

  if (!doc) {
    throw new Error(`Connection not found: ${connectionId}`);
  }

  if (doc.user_id !== userId) {
    throw new Error(
      `Access denied: Connection ${connectionId} belongs to different user`,
    );
  }

  await doc.update({ $set: updates });
}

export async function updateConnectionToken(
  db: RxDatabase<DatabaseCollections>,
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
): Promise<void> {
  const doc = await db.connection_documents
    .findOne({
      selector: {
        id: connectionId,
      },
    })
    .exec();

  if (!doc) {
    throw new Error(`Connection not found: ${connectionId}`);
  }

  if (doc.user_id !== userId) {
    throw new Error(
      `Access denied: Connection ${connectionId} belongs to different user`,
    );
  }

  await doc.update({ $set: tokenData });
}

export async function updateConnectionTimestamp(
  db: RxDatabase<DatabaseCollections>,
  userId: string,
  connectionId: string,
  timestampData: {
    last_refreshed?: string;
    last_sync_attempt?: string;
    last_sync_was_error?: boolean;
  },
): Promise<void> {
  const doc = await db.connection_documents
    .findOne({
      selector: {
        id: connectionId,
      },
    })
    .exec();

  if (!doc) {
    throw new Error(`Connection not found: ${connectionId}`);
  }

  if (doc.user_id !== userId) {
    throw new Error(
      `Access denied: Connection ${connectionId} belongs to different user`,
    );
  }

  await doc.update({ $set: timestampData });
}

export async function upsertConnection(
  db: RxDatabase<DatabaseCollections>,
  userId: string,
  connectionData: ConnectionDocument,
): Promise<void> {
  if (connectionData.user_id !== userId) {
    throw new Error('Cannot upsert connection for different user');
  }
  await db.connection_documents.upsert(connectionData);
}

export async function deleteConnection(
  db: RxDatabase<DatabaseCollections>,
  userId: string,
  connectionId: string,
): Promise<void> {
  const doc = await db.connection_documents
    .findOne({
      selector: {
        id: connectionId,
      },
    })
    .exec();

  if (!doc || doc.user_id !== userId) {
    return;
  }

  await doc.remove();
}
