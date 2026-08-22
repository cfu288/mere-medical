import { RxDocument, RxDatabase } from 'rxdb';
import { DatabaseCollections } from '../../app/providers/DatabaseCollections';
import {
  AnyConnectionDocument,
  ConnectionSources,
} from '../../models/connection-document/ConnectionDocument.type';
import * as connectionRepo from '../../repositories/ConnectionRepository';

type ConnectionOf<S extends ConnectionSources> = Extract<
  AnyConnectionDocument,
  { source: S }
>;

/**
 * Looks up a connection by the tenant it points at, rather than by URL.
 *
 * A tenant's published FHIR base URL can change form without the connection
 * becoming a different connection, so the tenant id is the stable identity.
 */
export async function getConnectionCardByTenant<S extends ConnectionSources>(
  source: S,
  tenantId: string,
  db: RxDatabase<DatabaseCollections>,
  userId: string,
): Promise<RxDocument<ConnectionOf<S>> | null> {
  const { rawConnection } =
    await connectionRepo.findConnectionBySourceAndTenant(
      db,
      userId,
      source,
      tenantId,
    );
  return rawConnection as unknown as RxDocument<ConnectionOf<S>> | null;
}

/**
 * @deprecated Look connections up by source and tenant instead
 * ({@link getConnectionCardByTenant}) - a url is not a connection identity.
 * Identity should eventually include the patient too, since one tenant can
 * hold several patients for a user.
 */
export async function getConnectionCardByUrl<S extends ConnectionSources>(
  source: S,
  url: string,
  db: RxDatabase<DatabaseCollections>,
  userId: string,
): Promise<RxDocument<ConnectionOf<S>> | null> {
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
  return result.rawConnection as unknown as RxDocument<ConnectionOf<S>>;
}
