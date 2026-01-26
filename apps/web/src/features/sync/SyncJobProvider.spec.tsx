import { render, waitFor, act, screen } from '@testing-library/react';
import { RxDatabase } from 'rxdb';
import { DatabaseCollections } from '../../app/providers/DatabaseCollections';
import { RxDbContext } from '../../app/providers/RxDbProvider';
import { NotificationProvider } from '../../app/providers/NotificationProvider';
import {
  createTestDatabase,
  cleanupTestDatabase,
} from '../../test-utils/createTestDatabase';
import { createTestConnection } from '../../test-utils/connectionTestData';
import { createDefaultTestUser } from '../../test-utils/userTestData';
import {
  SyncJobProvider,
  SyncFunctions,
  useSyncJobContext,
  useSyncJobDispatchContext,
} from './SyncJobProvider';
import { ConnectionDeletedError } from '../../shared/errors';
import { AppConfig } from '../../app/providers/AppConfigProvider';
import React from 'react';
import { UserDocument } from '../../models/user-document/UserDocument.type';

(global as unknown as { IS_DEMO: string }).IS_DEMO = 'disabled';

jest.mock('../../services/fhir/ConnectionService', () => ({
  recordSyncSuccess: jest.fn().mockResolvedValue(undefined),
  recordSyncError: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../repositories/ClinicalDocumentRepository', () => ({
  deleteOrphanedDocuments: jest.fn().mockResolvedValue(0),
}));

const mockAppConfig = {
  config: { PUBLIC_URL: 'https://test.example.com' } as AppConfig,
  isLoading: false,
  isStale: false,
};

jest.mock('../../app/providers/AppConfigProvider', () => ({
  useAppConfig: jest.fn(() => mockAppConfig),
  isConfigValid: (config: AppConfig) => !!config.PUBLIC_URL,
}));

let mockUser: UserDocument | undefined;

jest.mock('../../app/providers/UserProvider', () => ({
  useUser: jest.fn(() => {
    if (!mockUser) throw new Error('useUser must be used within UserProvider');
    return mockUser;
  }),
}));

jest.mock('../../app/providers/UserPreferencesProvider', () => ({
  useUserPreferences: jest.fn(() => ({ use_proxy: false })),
}));

jest.mock('../connections/hooks/useConnectionCards', () => ({
  useConnectionCards: jest.fn(() => []),
}));

interface TestProvidersProps {
  db: RxDatabase<DatabaseCollections>;
  children: React.ReactNode;
  notificationDispatchSpy?: jest.Mock;
  syncFunctions?: Partial<SyncFunctions>;
}

function TestProviders({
  db,
  children,
  notificationDispatchSpy,
  syncFunctions,
}: TestProvidersProps) {
  return (
    <NotificationProvider
      providedDispatch={notificationDispatchSpy}
      providedState={{
        showNotification: false,
        variant: 'success',
        message: '',
      }}
    >
      <RxDbContext.Provider value={db}>
        <SyncJobProvider syncFunctions={syncFunctions}>
          {children}
        </SyncJobProvider>
      </RxDbContext.Provider>
    </NotificationProvider>
  );
}

interface TestComponentProps {
  connectionId: string;
}

function TestComponent({ connectionId }: TestComponentProps) {
  const sync = useSyncJobContext();
  const dispatch = useSyncJobDispatchContext();
  const jobCount = Object.keys(sync).length;
  const hasJob = connectionId in sync;

  return (
    <div>
      <span data-testid="job-count">{jobCount}</span>
      <span data-testid="has-job">{String(hasJob)}</span>
      <button
        data-testid="cancel-sync"
        onClick={() => dispatch?.({ type: 'remove_job', id: connectionId })}
      />
    </div>
  );
}

function createPaginatedSyncMock(options: {
  totalPages: number;
  onPageFetch: (pageNumber: number) => void;
  pageDelayMs?: number;
}) {
  const { totalPages, onPageFetch, pageDelayMs = 10 } = options;

  return jest.fn(
    async (
      _connection: unknown,
      _db: unknown,
      signal?: AbortSignal,
    ): Promise<PromiseSettledResult<void[]>[]> => {
      for (let page = 1; page <= totalPages; page++) {
        if (signal?.aborted) {
          throw new DOMException('Sync was cancelled', 'AbortError');
        }

        onPageFetch(page);

        await new Promise((resolve) => setTimeout(resolve, pageDelayMs));

        if (signal?.aborted) {
          throw new DOMException('Sync was cancelled', 'AbortError');
        }
      }

      return [{ status: 'fulfilled', value: [] }];
    },
  );
}

describe('SyncJobProvider', () => {
  let db: RxDatabase<DatabaseCollections>;
  let testUser: UserDocument;

  beforeEach(async () => {
    jest.clearAllMocks();
    db = await createTestDatabase();
    testUser = createDefaultTestUser();
    mockUser = testUser;
  });

  afterEach(async () => {
    mockUser = undefined;
    await cleanupTestDatabase(db);
  });

  describe('abort stops pagination mid-sync', () => {
    it('demonstrates the bug: pagination continues when signal is ignored', async () => {
      const connection = createTestConnection({
        user_id: testUser.id,
        source: 'onpatient',
      });
      const connectionDoc = await db.connection_documents.insert(connection);

      const fetchedPages: number[] = [];
      const totalPages = 10;
      let resolveAbortTrigger: () => void;
      const abortTriggerPromise = new Promise<void>((resolve) => {
        resolveAbortTrigger = resolve;
      });

      const buggyMockSync = jest.fn(
        async (
          _connection: unknown,
          _db: unknown,
          _signal?: AbortSignal,
        ): Promise<PromiseSettledResult<void[]>[]> => {
          for (let page = 1; page <= totalPages; page++) {
            fetchedPages.push(page);
            if (page === 3) {
              resolveAbortTrigger();
            }
            await new Promise((resolve) => setTimeout(resolve, 50));
          }
          return [{ status: 'fulfilled', value: [] }];
        },
      );

      let dispatchRef: ReturnType<typeof useSyncJobDispatchContext>;
      const CaptureDispatch = () => {
        dispatchRef = useSyncJobDispatchContext();
        return null;
      };

      render(
        <TestProviders db={db} syncFunctions={{ onpatient: buggyMockSync }}>
          <CaptureDispatch />
          <TestComponent connectionId={connection.id} />
        </TestProviders>,
      );

      await act(async () => {
        dispatchRef!({
          type: 'add_job',
          config: { PUBLIC_URL: 'https://test.example.com' },
          id: connection.id,
          connectionDocument: connectionDoc,
          baseUrl: connection.location as string,
          useProxy: false,
          db,
        });
      });

      await act(async () => {
        await abortTriggerPromise;
      });

      await act(async () => {
        dispatchRef!({ type: 'remove_job', id: connection.id });
      });

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 600));
      });

      expect(fetchedPages.length).toBe(totalPages);
    });

    it('stops fetching pages when abort is triggered during pagination', async () => {
      const connection = createTestConnection({
        user_id: testUser.id,
        source: 'onpatient',
      });
      const connectionDoc = await db.connection_documents.insert(connection);

      const fetchedPages: number[] = [];
      const totalPages = 10;
      let resolveAbortTrigger: () => void;
      const abortTriggerPromise = new Promise<void>((resolve) => {
        resolveAbortTrigger = resolve;
      });

      const mockOnPatientSync = createPaginatedSyncMock({
        totalPages,
        pageDelayMs: 50,
        onPageFetch: (pageNumber) => {
          fetchedPages.push(pageNumber);
          if (pageNumber === 3) {
            resolveAbortTrigger();
          }
        },
      });

      let dispatchRef: ReturnType<typeof useSyncJobDispatchContext>;
      const CaptureDispatch = () => {
        dispatchRef = useSyncJobDispatchContext();
        return null;
      };

      render(
        <TestProviders db={db} syncFunctions={{ onpatient: mockOnPatientSync }}>
          <CaptureDispatch />
          <TestComponent connectionId={connection.id} />
        </TestProviders>,
      );

      await act(async () => {
        dispatchRef!({
          type: 'add_job',
          config: { PUBLIC_URL: 'https://test.example.com' },
          id: connection.id,
          connectionDocument: connectionDoc,
          baseUrl: connection.location as string,
          useProxy: false,
          db,
        });
      });

      await act(async () => {
        await abortTriggerPromise;
      });

      await act(async () => {
        dispatchRef!({ type: 'remove_job', id: connection.id });
      });

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 500));
      });

      expect(fetchedPages.length).toBeLessThan(totalPages);
      expect(fetchedPages.length).toBeGreaterThanOrEqual(3);
      expect(fetchedPages.length).toBeLessThanOrEqual(5);
    });

    it('completes all pages when not aborted', async () => {
      const connection = createTestConnection({
        user_id: testUser.id,
        source: 'onpatient',
      });
      const connectionDoc = await db.connection_documents.insert(connection);

      const fetchedPages: number[] = [];
      const totalPages = 5;
      let syncComplete: () => void;
      const syncCompletePromise = new Promise<void>((resolve) => {
        syncComplete = resolve;
      });

      const mockOnPatientSync = jest.fn(
        async (
          _connection: unknown,
          _db: unknown,
          signal?: AbortSignal,
        ): Promise<PromiseSettledResult<void[]>[]> => {
          for (let page = 1; page <= totalPages; page++) {
            if (signal?.aborted) {
              throw new DOMException('Sync was cancelled', 'AbortError');
            }
            fetchedPages.push(page);
            await new Promise((resolve) => setTimeout(resolve, 10));
          }
          syncComplete();
          return [{ status: 'fulfilled', value: [] }];
        },
      );

      let dispatchRef: ReturnType<typeof useSyncJobDispatchContext>;
      const CaptureDispatch = () => {
        dispatchRef = useSyncJobDispatchContext();
        return null;
      };

      render(
        <TestProviders db={db} syncFunctions={{ onpatient: mockOnPatientSync }}>
          <CaptureDispatch />
          <TestComponent connectionId={connection.id} />
        </TestProviders>,
      );

      await act(async () => {
        dispatchRef!({
          type: 'add_job',
          config: { PUBLIC_URL: 'https://test.example.com' },
          id: connection.id,
          connectionDocument: connectionDoc,
          baseUrl: connection.location as string,
          useProxy: false,
          db,
        });
      });

      await act(async () => {
        await syncCompletePromise;
      });

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
      });

      expect(fetchedPages).toEqual([1, 2, 3, 4, 5]);
    });
  });

  describe('abort behavior', () => {
    it('calls abort when remove_job is dispatched during active sync', async () => {
      const connection = createTestConnection({
        user_id: testUser.id,
        source: 'onpatient',
      });
      const connectionDoc = await db.connection_documents.insert(connection);

      let syncResolve: (value: PromiseSettledResult<void[]>[]) => void;
      const syncPromise = new Promise<PromiseSettledResult<void[]>[]>(
        (resolve) => {
          syncResolve = resolve;
        },
      );
      const mockOnPatientSync = jest.fn().mockReturnValue(syncPromise);

      const abortSpy = jest.spyOn(AbortController.prototype, 'abort');

      let dispatchRef: ReturnType<typeof useSyncJobDispatchContext>;
      const CaptureDispatch = () => {
        dispatchRef = useSyncJobDispatchContext();
        return null;
      };

      render(
        <TestProviders db={db} syncFunctions={{ onpatient: mockOnPatientSync }}>
          <CaptureDispatch />
          <TestComponent connectionId={connection.id} />
        </TestProviders>,
      );

      await act(async () => {
        dispatchRef!({
          type: 'add_job',
          config: { PUBLIC_URL: 'https://test.example.com' },
          id: connection.id,
          connectionDocument: connectionDoc,
          baseUrl: connection.location as string,
          useProxy: false,
          db,
        });
      });

      await waitFor(() => {
        expect(screen.getByTestId('has-job').textContent).toBe('true');
      });

      expect(mockOnPatientSync).toHaveBeenCalled();
      const passedSignal = mockOnPatientSync.mock.calls[0][2];
      expect(passedSignal).toBeInstanceOf(AbortSignal);
      expect(passedSignal.aborted).toBe(false);

      await act(async () => {
        dispatchRef!({ type: 'remove_job', id: connection.id });
      });

      expect(abortSpy).toHaveBeenCalled();
      expect(passedSignal.aborted).toBe(true);

      await act(async () => {
        syncResolve!([{ status: 'fulfilled', value: [] }]);
      });

      abortSpy.mockRestore();
    });
  });

  describe('error notification filtering', () => {
    it('does not trigger error notification for ConnectionDeletedError', async () => {
      const connection = createTestConnection({
        user_id: testUser.id,
        source: 'onpatient',
      });
      const connectionDoc = await db.connection_documents.insert(connection);

      const mockOnPatientSync = jest
        .fn()
        .mockRejectedValue(new ConnectionDeletedError(connection.id));

      const notificationSpy = jest.fn();

      let dispatchRef: ReturnType<typeof useSyncJobDispatchContext>;
      const CaptureDispatch = () => {
        dispatchRef = useSyncJobDispatchContext();
        return null;
      };

      render(
        <TestProviders
          db={db}
          notificationDispatchSpy={notificationSpy}
          syncFunctions={{ onpatient: mockOnPatientSync }}
        >
          <CaptureDispatch />
          <TestComponent connectionId={connection.id} />
        </TestProviders>,
      );

      await act(async () => {
        dispatchRef!({
          type: 'add_job',
          config: { PUBLIC_URL: 'https://test.example.com' },
          id: connection.id,
          connectionDocument: connectionDoc,
          baseUrl: connection.location as string,
          useProxy: false,
          db,
        });
      });

      await waitFor(() => {
        expect(notificationSpy).not.toHaveBeenCalledWith(
          expect.objectContaining({ variant: 'error' }),
        );
      });
    });

    it('does not trigger error notification for AbortError', async () => {
      const connection = createTestConnection({
        user_id: testUser.id,
        source: 'onpatient',
      });
      const connectionDoc = await db.connection_documents.insert(connection);

      const abortError = new Error('The operation was aborted');
      abortError.name = 'AbortError';
      const mockOnPatientSync = jest.fn().mockRejectedValue(abortError);

      const notificationSpy = jest.fn();

      let dispatchRef: ReturnType<typeof useSyncJobDispatchContext>;
      const CaptureDispatch = () => {
        dispatchRef = useSyncJobDispatchContext();
        return null;
      };

      render(
        <TestProviders
          db={db}
          notificationDispatchSpy={notificationSpy}
          syncFunctions={{ onpatient: mockOnPatientSync }}
        >
          <CaptureDispatch />
          <TestComponent connectionId={connection.id} />
        </TestProviders>,
      );

      await act(async () => {
        dispatchRef!({
          type: 'add_job',
          config: { PUBLIC_URL: 'https://test.example.com' },
          id: connection.id,
          connectionDocument: connectionDoc,
          baseUrl: connection.location as string,
          useProxy: false,
          db,
        });
      });

      await waitFor(() => {
        expect(notificationSpy).not.toHaveBeenCalledWith(
          expect.objectContaining({ variant: 'error' }),
        );
      });
    });

    it('triggers success notification when sync completes successfully', async () => {
      const connection = createTestConnection({
        user_id: testUser.id,
        source: 'onpatient',
      });
      const connectionDoc = await db.connection_documents.insert(connection);

      const mockOnPatientSync = jest
        .fn()
        .mockResolvedValue([{ status: 'fulfilled', value: [] }]);

      const notificationSpy = jest.fn();

      let dispatchRef: ReturnType<typeof useSyncJobDispatchContext>;
      const CaptureDispatch = () => {
        dispatchRef = useSyncJobDispatchContext();
        return null;
      };

      render(
        <TestProviders
          db={db}
          notificationDispatchSpy={notificationSpy}
          syncFunctions={{ onpatient: mockOnPatientSync }}
        >
          <CaptureDispatch />
          <TestComponent connectionId={connection.id} />
        </TestProviders>,
      );

      await act(async () => {
        dispatchRef!({
          type: 'add_job',
          config: { PUBLIC_URL: 'https://test.example.com' },
          id: connection.id,
          connectionDocument: connectionDoc,
          baseUrl: connection.location as string,
          useProxy: false,
          db,
        });
      });

      await waitFor(() => {
        expect(notificationSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'set_notification',
            variant: 'success',
            message: 'Successfully synced records',
          }),
        );
      });
    });

    it('triggers error notification for non-abort errors', async () => {
      const connection = createTestConnection({
        user_id: testUser.id,
        source: 'onpatient',
      });
      const connectionDoc = await db.connection_documents.insert(connection);

      const mockOnPatientSync = jest
        .fn()
        .mockResolvedValue([
          { status: 'rejected', reason: new Error('Network failure') },
        ]);

      const notificationSpy = jest.fn();

      let dispatchRef: ReturnType<typeof useSyncJobDispatchContext>;
      const CaptureDispatch = () => {
        dispatchRef = useSyncJobDispatchContext();
        return null;
      };

      render(
        <TestProviders
          db={db}
          notificationDispatchSpy={notificationSpy}
          syncFunctions={{ onpatient: mockOnPatientSync }}
        >
          <CaptureDispatch />
          <TestComponent connectionId={connection.id} />
        </TestProviders>,
      );

      await act(async () => {
        dispatchRef!({
          type: 'add_job',
          config: { PUBLIC_URL: 'https://test.example.com' },
          id: connection.id,
          connectionDocument: connectionDoc,
          baseUrl: connection.location as string,
          useProxy: false,
          db,
        });
      });

      await waitFor(() => {
        expect(notificationSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'set_notification',
            variant: 'error',
          }),
        );
      });
    });

    it('triggers info notification when some syncs succeed and some fail with non-abort errors', async () => {
      const connection = createTestConnection({
        user_id: testUser.id,
        source: 'onpatient',
      });
      const connectionDoc = await db.connection_documents.insert(connection);

      const mockOnPatientSync = jest.fn().mockResolvedValue([
        { status: 'fulfilled', value: [] },
        { status: 'rejected', reason: new Error('Partial failure') },
      ]);

      const notificationSpy = jest.fn();

      let dispatchRef: ReturnType<typeof useSyncJobDispatchContext>;
      const CaptureDispatch = () => {
        dispatchRef = useSyncJobDispatchContext();
        return null;
      };

      render(
        <TestProviders
          db={db}
          notificationDispatchSpy={notificationSpy}
          syncFunctions={{ onpatient: mockOnPatientSync }}
        >
          <CaptureDispatch />
          <TestComponent connectionId={connection.id} />
        </TestProviders>,
      );

      await act(async () => {
        dispatchRef!({
          type: 'add_job',
          config: { PUBLIC_URL: 'https://test.example.com' },
          id: connection.id,
          connectionDocument: connectionDoc,
          baseUrl: connection.location as string,
          useProxy: false,
          db,
        });
      });

      await waitFor(() => {
        expect(notificationSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'set_notification',
            variant: 'info',
            message: 'Some records were unable to be synced',
          }),
        );
      });
    });

    it('does not show error or info notification when only abort errors occur alongside successes', async () => {
      const connection = createTestConnection({
        user_id: testUser.id,
        source: 'onpatient',
      });
      const connectionDoc = await db.connection_documents.insert(connection);

      const abortError = new Error('Aborted');
      abortError.name = 'AbortError';
      const mockOnPatientSync = jest.fn().mockResolvedValue([
        { status: 'fulfilled', value: [] },
        { status: 'rejected', reason: abortError },
      ]);

      const notificationSpy = jest.fn();

      let dispatchRef: ReturnType<typeof useSyncJobDispatchContext>;
      const CaptureDispatch = () => {
        dispatchRef = useSyncJobDispatchContext();
        return null;
      };

      render(
        <TestProviders
          db={db}
          notificationDispatchSpy={notificationSpy}
          syncFunctions={{ onpatient: mockOnPatientSync }}
        >
          <CaptureDispatch />
          <TestComponent connectionId={connection.id} />
        </TestProviders>,
      );

      await act(async () => {
        dispatchRef!({
          type: 'add_job',
          config: { PUBLIC_URL: 'https://test.example.com' },
          id: connection.id,
          connectionDocument: connectionDoc,
          baseUrl: connection.location as string,
          useProxy: false,
          db,
        });
      });

      await waitFor(() => {
        expect(notificationSpy).not.toHaveBeenCalledWith(
          expect.objectContaining({ variant: 'error' }),
        );
        expect(notificationSpy).not.toHaveBeenCalledWith(
          expect.objectContaining({ variant: 'info' }),
        );
      });
    });

    it('does not show error or info notification when only ConnectionDeletedError occurs alongside successes', async () => {
      const connection = createTestConnection({
        user_id: testUser.id,
        source: 'onpatient',
      });
      const connectionDoc = await db.connection_documents.insert(connection);

      const mockOnPatientSync = jest.fn().mockResolvedValue([
        { status: 'fulfilled', value: [] },
        {
          status: 'rejected',
          reason: new ConnectionDeletedError(connection.id),
        },
      ]);

      const notificationSpy = jest.fn();

      let dispatchRef: ReturnType<typeof useSyncJobDispatchContext>;
      const CaptureDispatch = () => {
        dispatchRef = useSyncJobDispatchContext();
        return null;
      };

      render(
        <TestProviders
          db={db}
          notificationDispatchSpy={notificationSpy}
          syncFunctions={{ onpatient: mockOnPatientSync }}
        >
          <CaptureDispatch />
          <TestComponent connectionId={connection.id} />
        </TestProviders>,
      );

      await act(async () => {
        dispatchRef!({
          type: 'add_job',
          config: { PUBLIC_URL: 'https://test.example.com' },
          id: connection.id,
          connectionDocument: connectionDoc,
          baseUrl: connection.location as string,
          useProxy: false,
          db,
        });
      });

      await waitFor(() => {
        expect(notificationSpy).not.toHaveBeenCalledWith(
          expect.objectContaining({ variant: 'error' }),
        );
        expect(notificationSpy).not.toHaveBeenCalledWith(
          expect.objectContaining({ variant: 'info' }),
        );
      });
    });
  });
});
