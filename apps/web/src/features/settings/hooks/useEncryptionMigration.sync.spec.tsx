import { act, renderHook } from '@testing-library/react';
import {
  getInternalLokiStorage,
  getStorageAdapter,
  initEncryptedRxDb,
  initUnencrypedRxDb,
  useRxDb,
} from '../../../app/providers/RxDbProvider';
import { useUpdateLocalConfig } from '../../../app/providers/LocalConfigProvider';
import { bulkUpsertDocuments } from '../../../repositories/ClinicalDocumentRepository';
import * as clinicalDocuments from '../../../repositories/ClinicalDocumentRepository';
import {
  recordSyncError,
  recordSyncSuccess,
} from '../../../services/fhir/ConnectionService';
import { sync as epicSync } from '../../../services/fhir/Epic';
import {
  SyncJobProvider,
  useSyncJobDispatchContext,
} from '../../sync/SyncJobProvider';
import { useEncryptionMigration } from './useEncryptionMigration';

jest.mock('../../../app/providers/RxDbProvider');
jest.mock('../../../app/providers/LocalConfigProvider');
jest.mock('../../../app/providers/AppConfigProvider', () => ({
  useAppConfig: () => ({ isLoading: true }),
}));
jest.mock('../../../app/providers/UserPreferencesProvider', () => ({
  useUserPreferences: () => ({ use_proxy: false }),
}));
jest.mock('../../../app/providers/NotificationProvider', () => ({
  useNotificationDispatch: () => jest.fn(),
}));
jest.mock('../../connections/hooks/useConnectionCards', () => ({
  useConnectionCards: () => [],
}));
jest.mock('../../../services/fhir/ConnectionService');
jest.mock('../../../services/fhir/sync/resolveSyncContext', () => ({
  contextAfterRefresh: (ctx: unknown) => ctx,
}));
jest.mock('../../../services/fhir/Epic', () => ({
  sync: { syncAllRecords: jest.fn() },
}));

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function database() {
  const records = new Map<string, { id: string }>();
  return {
    records,
    clinical_documents: {
      insert: jest.fn(async (doc: { metadata: { id: string } }) => {
        records.set(doc.metadata.id, { id: doc.metadata.id });
      }),
      bulkUpsert: jest.fn(async (docs: { id: string }[]) => {
        docs.forEach((doc) => records.set(doc.id, doc));
      }),
    },
    exportJSON: jest.fn(async () => ({
      collections: [
        { name: 'clinical_documents', docs: [...records.values()] },
      ],
    })),
    importJSON: jest.fn(async (dump) => {
      dump.collections.forEach((col: { docs: { id: string }[] }) => {
        col.docs.forEach((doc) => records.set(doc.id, doc));
      });
      return [{ success: {}, error: {} }];
    }),
    remove: jest.fn(async () => {
      records.clear();
    }),
  };
}

describe('encryption migration with background sync', () => {
  let source: ReturnType<typeof database>;
  let target: ReturnType<typeof database>;
  let response: ReturnType<typeof deferred>;
  let written: ReturnType<typeof deferred>;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(recordSyncError).mockResolvedValue(undefined);
    jest.mocked(recordSyncSuccess).mockResolvedValue(undefined);
    Object.defineProperty(globalThis, 'IS_DEMO', {
      value: 'disabled',
      configurable: true,
    });
    jest.useFakeTimers();
    jest.spyOn(console, 'group').mockImplementation(() => undefined);
    jest.spyOn(console, 'groupEnd').mockImplementation(() => undefined);
    source = database();
    target = database();
    response = deferred();
    written = deferred();
    jest.mocked(useRxDb).mockReturnValue(source as never);
    jest.mocked(useUpdateLocalConfig).mockReturnValue(jest.fn());
    jest.mocked(initEncryptedRxDb).mockResolvedValue(target as never);
    jest.mocked(initUnencrypedRxDb).mockResolvedValue(target as never);
    jest.mocked(getInternalLokiStorage).mockResolvedValue({
      saveDatabase: (callback: () => void) => callback(),
    } as never);
    jest.mocked(getStorageAdapter).mockResolvedValue({
      getDatabaseListAsync: async () => [],
    } as never);
    jest.mocked(epicSync.syncAllRecords).mockImplementation(async (ctx) => {
      await response.promise;
      await bulkUpsertDocuments(ctx.db, [{ id: 'late-record' }] as never);
      written.resolve();
      return [{ status: 'fulfilled', value: undefined }];
    });
  });

  afterEach(() => {
    Reflect.deleteProperty(globalThis, 'IS_DEMO');
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  function setup() {
    return renderHook(
      () => {
        const dispatch = useSyncJobDispatchContext();
        const migration = useEncryptionMigration(jest.fn());
        if (!dispatch)
          throw new Error('SyncJobProvider is required for this test');
        return { dispatch, migration };
      },
      { wrapper: SyncJobProvider },
    );
  }

  function job(id = 'epic-connection') {
    return {
      type: 'add_job' as const,
      id,
      ctx: {
        db: source,
        document: { source: 'epic' },
        connection: { get: (key: string) => key },
      } as never,
    };
  }

  it.each([false, true])(
    'preserves a sync write arriving during migration (source encrypted: %s)',
    async (encrypted) => {
      // Keep the copy open until the in-flight request writes to the source.
      // Without draining, this write lands after the dump and is then deleted.
      const importJSON = target.importJSON.getMockImplementation();
      if (!importJSON) throw new Error('Import stub is required');
      target.importJSON.mockImplementation(async (dump) => {
        await written.promise;
        return importJSON(dump);
      });
      const { result } = setup();
      await act(async () => {
        result.current.dispatch(job());
      });
      expect(epicSync.syncAllRecords).toHaveBeenCalledTimes(1);
      let migration!: Promise<void>;
      await act(async () => {
        migration = result.current.migration.migrate(
          encrypted ? undefined : 'password',
        );
      });
      await act(async () => {
        response.resolve();
        await migration;
      });
      expect(source.remove).toHaveBeenCalledTimes(1);
      expect(source.records.has('late-record')).toBe(false);
      expect(target.records.has('late-record')).toBe(true);
    },
  );

  it.each([false, true])(
    'blocks new jobs through a successful switch (source encrypted: %s)',
    async (encrypted) => {
      const importing = deferred();
      target.importJSON.mockImplementation(async () => {
        await importing.promise;
        return [{ success: {}, error: {} }];
      });
      const { result } = setup();
      let migration!: Promise<void>;
      await act(async () => {
        migration = result.current.migration.migrate(
          encrypted ? undefined : 'password',
        );
      });
      expect(target.importJSON).toHaveBeenCalledTimes(1);
      await act(async () => {
        result.current.dispatch(job('scheduled-during-import'));
      });
      expect(epicSync.syncAllRecords).not.toHaveBeenCalled();
      await act(async () => {
        importing.resolve();
        await migration;
      });
      await act(async () => {
        result.current.dispatch(job('scheduled-after-switch'));
      });
      expect(epicSync.syncAllRecords).not.toHaveBeenCalled();
    },
  );

  it.each([false, true])(
    'resumes queued jobs on the intact source after failure (source encrypted: %s)',
    async (encrypted) => {
      const importing = deferred();
      target.importJSON.mockImplementation(async () => {
        await importing.promise;
        throw new Error('Import failed');
      });
      const { result } = setup();
      let migration!: Promise<void>;
      await act(async () => {
        migration = result.current.migration.migrate(
          encrypted ? undefined : 'password',
        );
      });
      await act(async () => {
        result.current.dispatch(job());
        result.current.dispatch(job());
      });
      expect(epicSync.syncAllRecords).not.toHaveBeenCalled();
      await act(async () => {
        importing.resolve();
        await migration;
        response.resolve();
        await written.promise;
      });
      expect(epicSync.syncAllRecords).toHaveBeenCalledTimes(1);
      expect(source.remove).not.toHaveBeenCalled();
      expect(source.records.has('late-record')).toBe(true);
      expect(result.current.migration.error).toMatch(
        /original database is still selected/,
      );
    },
  );

  it('waits for final connection writes even if the job UI entry is removed', async () => {
    const timestamp = deferred();
    jest.mocked(recordSyncSuccess).mockImplementation(async () => {
      await timestamp.promise;
    });
    const { result } = setup();
    await act(async () => {
      result.current.dispatch(job());
      response.resolve();
      await written.promise;
    });
    expect(recordSyncSuccess).toHaveBeenCalledTimes(1);
    await act(async () => {
      result.current.dispatch({ type: 'remove_job', id: 'epic-connection' });
    });
    let migration!: Promise<void>;
    await act(async () => {
      migration = result.current.migration.migrate('password');
    });
    expect(source.exportJSON).not.toHaveBeenCalled();
    await act(async () => {
      timestamp.resolve();
      await migration;
    });
    expect(target.records.has('late-record')).toBe(true);
  });

  it('drains rejected jobs through their final error timestamp write', async () => {
    const timestamp = deferred();
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    jest.mocked(epicSync.syncAllRecords).mockImplementation(async () => {
      await response.promise;
      throw new Error('Request failed');
    });
    jest.mocked(recordSyncError).mockImplementation(async () => {
      await timestamp.promise;
    });
    const { result } = setup();
    await act(async () => {
      result.current.dispatch(job());
    });
    let migration!: Promise<void>;
    await act(async () => {
      migration = result.current.migration.migrate('password');
      response.resolve();
    });
    expect(recordSyncError).toHaveBeenCalledTimes(1);
    expect(source.exportJSON).not.toHaveBeenCalled();
    await act(async () => {
      timestamp.resolve();
      await migration;
    });
    expect(source.remove).toHaveBeenCalledTimes(1);
  });

  it('keeps jobs paused if source cleanup fails after committing the target', async () => {
    source.remove.mockRejectedValue(new Error('Cleanup failed'));
    const { result } = setup();
    await act(async () => {
      await result.current.migration.migrate('password');
    });
    await act(async () => {
      result.current.dispatch(job());
    });
    expect(epicSync.syncAllRecords).not.toHaveBeenCalled();
    expect(result.current.migration.needsReload).toBe(true);
  });

  it('retains a queued retry when the running job completes during the drain', async () => {
    const { result } = setup();
    await act(async () => {
      result.current.dispatch(job());
    });
    source.exportJSON.mockRejectedValue(new Error('Export failed'));
    let migration!: Promise<void>;
    await act(async () => {
      migration = result.current.migration.migrate('password');
      result.current.dispatch(job());
    });
    await act(async () => {
      response.resolve();
      await migration;
    });
    expect(epicSync.syncAllRecords).toHaveBeenCalledTimes(2);
    expect(source.remove).not.toHaveBeenCalled();
  });

  it.each([false, true])(
    'preserves a late Epic attachment when a sibling fails (source encrypted: %s)',
    async (encrypted) => {
      const actualEpic = jest.requireActual<
        typeof import('../../../services/fhir/Epic')
      >('../../../services/fhir/Epic');
      jest
        .mocked(epicSync.syncAllRecords)
        .mockImplementation(actualEpic.sync.syncAllRecords);
      jest.spyOn(console, 'error').mockImplementation(() => undefined);
      const attachmentStarted = deferred();
      jest
        .spyOn(clinicalDocuments, 'findDocumentsByResourceType')
        .mockResolvedValue(
          ['Binary/error', 'Binary/slow'].map((url) => ({
            connection_record_id: 'epic-connection',
            metadata: {},
            data_record: {
              raw: { resource: { content: [{ attachment: { url } }] } },
            },
          })) as never,
        );
      jest
        .spyOn(clinicalDocuments, 'documentExistsByMetadataId')
        .mockResolvedValue(false);
      const originalInsert =
        source.clinical_documents.insert.getMockImplementation();
      if (!originalInsert) throw new Error('Insert stub is required');
      source.clinical_documents.insert.mockImplementation(async (doc) => {
        await originalInsert(doc);
        written.resolve();
      });
      const originalImport = target.importJSON.getMockImplementation();
      if (!originalImport) throw new Error('Import stub is required');
      target.importJSON.mockImplementation(async (dump) => {
        await written.promise;
        return originalImport(dump);
      });
      const previousFetch = globalThis.fetch;
      globalThis.fetch = jest.fn(async (input) => {
        const url = String(input);
        if (url.endsWith('Binary/error'))
          throw new Error('Attachment request failed');
        if (url.endsWith('Binary/slow')) {
          attachmentStarted.resolve();
          await response.promise;
          return {
            ok: true,
            headers: { get: () => 'text/plain' },
            text: async () => 'Test attachment',
          } as unknown as Response;
        }
        return {
          ok: true,
          json: async () => ({ entry: [] }),
        } as unknown as Response;
      });
      try {
        const { result } = setup();
        const action = job();
        action.ctx = {
          db: source,
          config: {},
          fhirBaseUrl: 'https://fhir.example.test/',
          document: {
            source: 'epic',
            user_id: 'test-user',
            id: action.id,
            patient: 'test-patient',
            fhir_version: 'R4',
          },
          connection: { get: (key: string) => key },
        } as never;
        await act(async () => {
          result.current.dispatch(action);
        });
        await attachmentStarted.promise;
        let migration!: Promise<void>;
        await act(async () => {
          migration = result.current.migration.migrate(
            encrypted ? undefined : 'password',
          );
        });
        await act(async () => {
          response.resolve();
          await migration;
        });
        expect(source.remove).toHaveBeenCalledTimes(1);
        expect(target.records.has('Binary/slow')).toBe(true);
      } finally {
        globalThis.fetch = previousFetch;
      }
    },
  );
});
