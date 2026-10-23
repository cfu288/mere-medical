import { RxDatabase } from 'rxdb';
import { DatabaseCollections } from '../app/providers/DatabaseCollections';
import { InstanceConfigDocumentType } from '../models/instance-config/InstanceConfig.collection';

const INSTANCE_CONFIG_ID = 'instance_config';

/**
 * Reads the server config the app saved last, such as the EHR client ids. The
 * app config provider uses it until the server answers.
 *
 * @param db `RxDatabase<DatabaseCollections>`.
 * @returns `Promise<InstanceConfigDocumentType | null>`. Null before the first
 * save.
 *
 * @example
 * const cached = await findInstanceConfig(db);
 */
export async function findInstanceConfig(
  db: RxDatabase<DatabaseCollections>,
): Promise<InstanceConfigDocumentType | null> {
  const doc = await db.instance_config.findOne(INSTANCE_CONFIG_ID).exec();
  return doc ? (doc.toJSON() as InstanceConfigDocumentType) : null;
}

/**
 * Saves the server config, replacing the one saved before, and stamps the
 * save time. The app config provider calls it after each fetch.
 *
 * @param db `RxDatabase<DatabaseCollections>`.
 * @param config `Omit<InstanceConfigDocumentType, 'id' | 'updated_at'>`.
 * @returns `Promise<void>`.
 *
 * @example
 * await saveInstanceConfig(db, { EPIC_CLIENT_ID: 'epic-client' });
 */
export async function saveInstanceConfig(
  db: RxDatabase<DatabaseCollections>,
  config: Omit<InstanceConfigDocumentType, 'id' | 'updated_at'>,
): Promise<void> {
  await db.instance_config.upsert({
    id: INSTANCE_CONFIG_ID,
    ...config,
    updated_at: Date.now(),
  });
}
