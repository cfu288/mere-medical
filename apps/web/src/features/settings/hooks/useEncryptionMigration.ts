import { useCallback, useRef, useState } from 'react';
import { RxDatabase, RxStorageBulkWriteResponse } from 'rxdb';
import { CryptedIndexedDBAdapter } from 'sylviejs/storage-adapter/crypted-indexeddb-adapter';
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

export function useEncryptionMigration(onSuccess: () => void) {
  const db = useRxDb();
  const updateLocalConfig = useUpdateLocalConfig();
  const running = useRef(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');
  const [needsReload, setNeedsReload] = useState(false);

  const migrate = useCallback(
    async (password?: string) => {
      if (running.current || needsReload) return;
      running.current = true;
      setIsProcessing(true);
      setError('');
      const encrypted = password !== undefined;
      let target: RxDatabase<DatabaseCollections> | undefined;

      try {
        if (!encrypted) await saveEncryptedDatabase(db);
        const dump = await db.exportJSON();
        // RxDB's bulk writer cannot import an empty collection.
        dump.collections = dump.collections.filter(
          (col) => col.docs.length > 0,
        );
        target = encrypted
          ? await initEncryptedRxDb(password)
          : await initUnencrypedRxDb();
        // RxDB 13 returns bulk-write results despite declaring Promise<void>.
        const results = (await target.importJSON(
          dump,
        )) as unknown as RxStorageBulkWriteResponse<unknown>[];
        if (results.some((result) => Object.keys(result.error).length > 0)) {
          throw new Error('Some records could not be copied');
        }
        // Dexie imports await IndexedDB writes; Loki needs an explicit save.
        if (encrypted) await saveEncryptedDatabase(target);
        updateLocalConfig({ use_encrypted_database: encrypted });
      } catch {
        // The source and mode are still intact. Discard partial copies so a
        // retry cannot conflict with records from an earlier failed import.
        let cleanupFailed = false;
        if (target) {
          try {
            await removeDatabase(target, encrypted);
          } catch {
            cleanupFailed = true;
          }
        }
        setError(
          'Unable to change encryption. Your original database is still selected. ' +
            (cleanupFailed
              ? 'The incomplete copy could not be removed. Reload Mere before trying again.'
              : 'Please try again.'),
        );
        setNeedsReload(cleanupFailed);
        running.current = false;
        setIsProcessing(false);
        return;
      }

      try {
        // Commit the mode before deleting anything from the source. A cleanup
        // failure must keep the verified target selected, never roll back to a
        // source that may already have been partially removed.
        await removeDatabase(db, !encrypted);
        onSuccess();
        setTimeout(() => window.location.reload(), 0);
      } catch {
        setError(
          'Your records and encryption setting were saved, but the old database could not be fully removed. Reload Mere before trying again. An unencrypted copy may still remain on this device.',
        );
        setNeedsReload(true);
      } finally {
        running.current = false;
        setIsProcessing(false);
      }
    },
    [db, needsReload, onSuccess, updateLocalConfig],
  );

  return { migrate, isProcessing, error, needsReload };
}
