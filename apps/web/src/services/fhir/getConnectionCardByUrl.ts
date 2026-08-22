import { RxDocument, RxDatabase } from 'rxdb';
import { DatabaseCollections } from '../../app/providers/DatabaseCollections';
import {
  ConnectionDocument,
  ConnectionSources,
} from '../../models/connection-document/ConnectionDocument.type';
import * as connectionRepo from '../../repositories/ConnectionRepository';

/**
 * Looks up a connection by the tenant it points at, rather than by URL.
 *
 * A tenant's published FHIR base URL can change form without the connection
 * becoming a different connection, so the tenant id is the stable identity.
 */
export async function getConnectionCardByTenant<T extends ConnectionDocument>(
  source: ConnectionSources,
  tenantId: string,
  db: RxDatabase<DatabaseCollections>,
  userId: string,
): Promise<RxDocument<T> | null> {
  const { rawConnection } =
    await connectionRepo.findConnectionBySourceAndTenant(
      db,
      userId,
      source,
      tenantId,
    );
  return rawConnection as unknown as RxDocument<T> | null;
}

/**
 * @deprecated Look connections up by source and tenant instead
 * ({@link getConnectionCardByTenant}) - a url is not a connection identity.
 * Identity should eventually include the patient too, since one tenant can
 * hold several patients for a user.
 */
export async function getConnectionCardByUrl<T extends ConnectionDocument>(
  source: ConnectionSources,
  url: string,
  db: RxDatabase<DatabaseCollections>,
  userId: string,
): Promise<RxDocument<T> | null> {
  const connection = await connectionRepo.findConnectionByUrl(
    db,
    userId,
    source,
    url,
  );
  if (!connection) {
    return null;
  }

  const result = await connectionRepo.findConnectionWithDoc(
    db,
    userId,
    connection.id,
  );
  return result.rawConnection as unknown as RxDocument<T>;
}
