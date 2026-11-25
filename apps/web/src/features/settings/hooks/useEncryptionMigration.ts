import { useCallback, useRef, useState } from 'react';
import { RxDatabase, RxStorageBulkWriteResponse } from 'rxdb';
import { CryptedIndexedDBAdapter } from 'sylviejs/storage-adapter/crypted-indexeddb-adapter';
import { usePauseSyncJobs } from '../../sync/SyncJobProvider';
import { DatabaseCollections } from '../../../app/providers/DatabaseCollections';
import { useUpdateLocalConfig } from '../../../app/providers/LocalConfigProvider';
import {
  getInternalLokiStorage,
  getStorageAdapter,
  initEncryptedRxDb,
  initUnencrypedRxDb,
  useRxDb,
} from '../../../app/providers/RxDbProvider';

async function saveEncryptedDatabase(db: RxDatabase<DatabaseCollections>) {
  const internalDb = await getInternalLokiStorage(db);
  // Loki keeps writes in memory. Wait for persistence before selecting this copy.
  await new Promise<void>((resolve, reject) => {
    internalDb.saveDatabase((result) => {
      if (!result || result.success === true) resolve();
      else reject(result);
    });
  });
}

async function removeDatabase(
  db: RxDatabase<DatabaseCollections>,
  encrypted: boolean,
) {
  const adapter = encrypted
    ? ((await getStorageAdapter(db)) as CryptedIndexedDBAdapter)
    : undefined;
  await db.remove();
  // RxDB removes Loki collections, but leaves the adapter's persisted file.
  // Sylvie's delete promise does not settle when the file never existed (for
  // example, when encryption failed before the first write).
  if (
    adapter &&
    (await adapter.getDatabaseListAsync()).includes('mere_db.db')
  ) {
    await adapter.deleteDatabaseAsync('mere_db.db');
  }
}

type MigrationState =
  // -> processing: migrate()
  | { status: 'idle' }
  // -> failed. -> idle: done, and the page reloads
  | { status: 'processing' }
  // -> processing: migrate(), unless needsReload (a copy could not be removed)
  | { status: 'failed'; error: string; needsReload: boolean };

export function useEncryptionMigration(onSuccess: () => void) {
  const db = useRxDb();
  const pauseSyncJobs = usePauseSyncJobs();
  const updateLocalConfig = useUpdateLocalConfig();
  const running = useRef(false);
  const [state, setState] = useState<MigrationState>({ status: 'idle' });
  const needsReload = state.status === 'failed' && state.needsReload;

  const migrate = useCallback(
    async (password?: string) => {
      if (running.current || needsReload) return;
      running.current = true;
      setState({ status: 'processing' });
      const encrypted = password !== undefined;
      let target: RxDatabase<DatabaseCollections> | undefined;
      let resumeSyncJobs: (() => void) | undefined;

      try {
        console.debug(
          encrypted
            ? 'useEncryptionMigration: Migrating from unencrypted to encrypted database'
            : 'useEncryptionMigration: Migrating from encrypted to unencrypted database',
        );
        console.debug('useEncryptionMigration: Waiting for running sync jobs');
        resumeSyncJobs = await pauseSyncJobs();
        if (!encrypted) {
          console.debug(
            'useEncryptionMigration: Forcing final write of Loki memory to idb',
          );
          await saveEncryptedDatabase(db);
        }
        console.debug('useEncryptionMigration: Exporting current database');
        const dump = await db.exportJSON();
        // RxDB's bulk writer cannot import an empty collection.
        dump.collections = dump.collections.filter(
          (col) => col.docs.length > 0,
        );
        console.debug(
          encrypted
            ? 'useEncryptionMigration: Creating new encrypted database'
            : 'useEncryptionMigration: Creating new unencrypted database',
        );
        target = encrypted
          ? await initEncryptedRxDb(password)
          : await initUnencrypedRxDb();
        console.debug(
          'useEncryptionMigration: Importing data into new database',
        );
        // RxDB 13 returns bulk-write results despite declaring Promise<void>.
        const results = (await target.importJSON(
          dump,
        )) as unknown as RxStorageBulkWriteResponse<unknown>[];
        if (results.some((result) => Object.keys(result.error).length > 0)) {
          throw new Error('Some records could not be copied');
        }
        // Dexie imports await IndexedDB writes; Loki needs an explicit save.
        if (encrypted) {
          console.debug(
            'useEncryptionMigration: Forcing final write of Loki memory to idb',
          );
          await saveEncryptedDatabase(target);
        }
        console.debug(
          'useEncryptionMigration: Saving the new encryption setting',
        );
        updateLocalConfig({ use_encrypted_database: encrypted });
      } catch (e) {
        console.error(e);
        // The source and mode are still intact. Discard partial copies so a
        // retry cannot conflict with records from an earlier failed import.
        let cleanupFailed = false;
        if (target) {
          try {
            await removeDatabase(target, encrypted);
          } catch (e) {
            console.error(e);
            cleanupFailed = true;
          }
        }
        resumeSyncJobs?.();
        setState({
          status: 'failed',
          error:
            'Unable to change encryption. Your original database is still selected. ' +
            (cleanupFailed
              ? 'The incomplete copy could not be removed. Reload Mere before trying again.'
              : 'Please try again.'),
          needsReload: cleanupFailed,
        });
        // A leftover partial copy keeps the migration locked until reload.
        running.current = cleanupFailed;
        return;
      }

      try {
        // Commit the mode before deleting anything from the source. A cleanup
        // failure must keep the verified target selected, never roll back to a
        // source that may already have been partially removed.
        // Keep sync paused through reload: queued jobs still hold the source.
        console.debug(
          encrypted
            ? 'useEncryptionMigration: Deleting old unencrypted database'
            : 'useEncryptionMigration: Deleting old encrypted database',
        );
        await removeDatabase(db, !encrypted);
        console.debug('useEncryptionMigration: Completed migration');
        onSuccess();
        setState({ status: 'idle' });
        setTimeout(() => window.location.reload(), 0);
      } catch (e) {
        console.error(e);
        setState({
          status: 'failed',
          error:
            'Your records and encryption setting were saved, but the old database could not be fully removed. Reload Mere before trying again. An unencrypted copy may still remain on this device.',
          needsReload: true,
        });
      }
      // Both outcomes end in a reload, so the migration stays locked.
    },
    [db, needsReload, onSuccess, pauseSyncJobs, updateLocalConfig],
  );

  return {
    migrate,
    isProcessing: state.status === 'processing',
    error: state.status === 'failed' ? state.error : '',
    needsReload,
  };
}
