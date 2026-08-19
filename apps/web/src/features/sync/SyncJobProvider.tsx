import React, { useCallback, useContext, useEffect, useMemo } from 'react';
import { PropsWithChildren } from 'react';
import { RxDocument, RxDatabase } from 'rxdb';
import {
  ConnectionDocument,
  AnyConnectionDocument,
} from '../../models/connection-document/ConnectionDocument.type';
import {
  contextAfterRefresh,
  resolveSyncContext,
} from '../../services/fhir/sync/resolveSyncContext';
import { useRxDb } from '../../app/providers/RxDbProvider';
import { DatabaseCollections } from '../../app/providers/DatabaseCollections';
import * as OnPatient from '../../services/fhir/OnPatient';
import * as Epic from '../../services/fhir/Epic';
import * as Cerner from '../../services/fhir/Cerner';
import * as Veradigm from '../../services/fhir/Veradigm';
import * as VA from '../../services/fhir/VA';
import * as Healow from '../../services/fhir/Healow';
import * as Athena from '../../services/fhir/Athena';
import * as NextGen from '../../services/fhir/NextGen';
import { SyncContext, VendorSync } from '../../services/fhir/sync';
import { from, Subject } from 'rxjs';
import { useNotificationDispatch } from '../../app/providers/NotificationProvider';
import { differenceInDays, parseISO } from 'date-fns';
import {
  useAppConfig,
  isConfigValid,
} from '../../app/providers/AppConfigProvider';
import { useUserPreferences } from '../../app/providers/UserPreferencesProvider';
import { useConnectionCards } from '../connections/hooks/useConnectionCards';
import {
  recordSyncSuccess,
  recordSyncError,
} from '../../services/fhir/ConnectionService';

/**
 * Refreshes the connection's tokens when needed and returns the context to
 * sync with; the context passed in predates the refresh and must not be used.
 */
async function refreshIfNeeded(ctx: SyncContext): Promise<SyncContext> {
  const document = ctx.document;
  switch (document.source) {
    case 'epic':
      await Epic.sync.refreshToken?.({ ...ctx, document });
      break;
    case 'cerner':
      await Cerner.sync.refreshToken?.({ ...ctx, document });
      break;
    case 'healow':
      await Healow.sync.refreshToken?.({ ...ctx, document });
      break;
    case 'veradigm':
      await Veradigm.sync.refreshToken?.({ ...ctx, document });
      break;
    case 'athena':
      await Athena.sync.refreshToken?.({ ...ctx, document });
      break;
    case 'va':
      await VA.sync.refreshToken?.({ ...ctx, document });
      break;
    case 'onpatient':
      await OnPatient.sync.refreshToken?.({ ...ctx, document });
      break;
    case 'nextgen':
      await NextGen.sync.refreshToken?.({ ...ctx, document });
      break;
    default:
      return assertNever(document);
  }
  return contextAfterRefresh(ctx);
}

async function syncWithVendor(
  ctx: SyncContext,
): Promise<PromiseSettledResult<unknown>[]> {
  const refreshed = await refreshIfNeeded(ctx);
  const document = refreshed.document;
  switch (document.source) {
    case 'epic':
      return Epic.sync.syncAllRecords({ ...refreshed, document });
    case 'cerner':
      return Cerner.sync.syncAllRecords({ ...refreshed, document });
    case 'healow':
      return Healow.sync.syncAllRecords({ ...refreshed, document });
    case 'veradigm':
      return Veradigm.sync.syncAllRecords({ ...refreshed, document });
    case 'athena':
      return Athena.sync.syncAllRecords({ ...refreshed, document });
    case 'va':
      return VA.sync.syncAllRecords({ ...refreshed, document });
    case 'onpatient':
      return OnPatient.sync.syncAllRecords({ ...refreshed, document });
    case 'nextgen':
      return NextGen.sync.syncAllRecords({ ...refreshed, document });
    default:
      return assertNever(document);
  }
}

function assertNever(value: never): never {
  throw new Error(`Cannot sync unknown source: ${JSON.stringify(value)}`);
}

type SyncJobProviderProps = PropsWithChildren<unknown>;

const SyncJobContext = React.createContext<
  Record<string, Subject<PromiseSettledResult<unknown>[]>>
>({});

const SyncJobDispatchContext = React.createContext<Dispatch | undefined>(
  undefined,
);

type Action =
  | { type: 'add_job'; id: string; ctx: SyncContext }
  | { type: 'remove_job'; id: string };

type Dispatch = (action: Action) => void;

const syncJobReducer: (
  state: Record<string, Subject<PromiseSettledResult<unknown>[]>>,
  action: Action,
) => Record<string, Subject<PromiseSettledResult<unknown>[]>> = (
  state: Record<string, Subject<PromiseSettledResult<unknown>[]>>,
  action: Action,
) => {
  switch (action.type) {
    case 'add_job': {
      const subject = new Subject<PromiseSettledResult<unknown>[]>();
      const observable = from(fetchMedicalRecords(action.ctx));
      observable.subscribe(subject);
      return {
        ...state,
        [action.id]: subject,
      };
    }
    case 'remove_job': {
      const nState = { ...state };
      delete nState[action.id];
      return nState;
    }
    default: {
      throw new Error(`Unhandled action type: ${action}`);
    }
  }
};

/**
 * A provider that handles sync jobs that manages syncing medical records for connections
 * Also provides a dispatch function to add/remove sync jobs
 */
export function SyncJobProvider(props: SyncJobProviderProps) {
  const [state, dispatch] = React.useReducer(
    syncJobReducer,
    {} as Record<string, Subject<PromiseSettledResult<unknown>[]>>,
  );

  return (
    <SyncJobContext.Provider value={state}>
      <SyncJobDispatchContext.Provider value={dispatch}>
        <OnHandleUnsubscribeJobs>
          <HandleInitalSync>{props.children}</HandleInitalSync>
        </OnHandleUnsubscribeJobs>
      </SyncJobDispatchContext.Provider>
    </SyncJobContext.Provider>
  );
}

/**
 * Wrapping component that initiates a connection sync job for each connection card
 * if they have not been synced in the last week
 */
function HandleInitalSync({ children }: PropsWithChildren) {
  const sync = useSyncJobContext(),
    syncD = useSyncJobDispatchContext(),
    userPreferences = useUserPreferences(),
    conList = useConnectionCards(),
    db = useRxDb(),
    { config, isLoading: isConfigLoading } = useAppConfig(),
    isDemo = IS_DEMO === 'enabled',
    currentSyncJobLength = Object.keys(sync).length,
    syncJobEntries = useMemo(() => new Set(Object.keys(sync)), [sync]),
    handleFetchData = useCallback(
      (item: RxDocument<AnyConnectionDocument>) => {
        if (syncD && userPreferences) {
          const parsed = resolveSyncContext({
            config,
            db,
            connection: item,
            useProxy: userPreferences.use_proxy,
          });
          if (!parsed.ok) {
            console.error(parsed.reason);
            recordSyncError(db, item.get('user_id'), item.get('id')).catch(
              console.error,
            );
            return;
          }
          syncD({ type: 'add_job', id: item.toJSON().id, ctx: parsed.ctx });
        }
      },
      [config, db, syncD, userPreferences],
    ),
    startSyncAllConnections = useCallback(() => {
      if (conList) {
        console.group('SyncJobProvider: Syncing Connections:');
        for (const item of conList) {
          startSyncConnection(item, syncJobEntries, handleFetchData);
        }
        console.groupEnd();
      }
    }, [conList, handleFetchData, syncJobEntries]);

  useEffect(() => {
    if (isConfigLoading) return;
    if (!isConfigValid(config)) return;
    if (!isDemo) {
      if (currentSyncJobLength === 0) {
        console.debug(
          'SyncJobProvider: Current Sync Jobs In Progress: ' +
            currentSyncJobLength,
        );
        startSyncAllConnections();
      }
    }
  }, [
    isConfigLoading,
    config,
    isDemo,
    startSyncAllConnections,
    currentSyncJobLength,
  ]);

  return <>{children}</>;
}

function startSyncConnection(
  item: RxDocument<AnyConnectionDocument>,
  syncJobEntries: Set<string>,
  handleFetchData: (item: RxDocument<AnyConnectionDocument>) => void,
) {
  if (
    !item.get('last_refreshed') ||
    (item.get('last_refreshed') &&
      Math.abs(
        differenceInDays(parseISO(item.get('last_refreshed')), new Date()),
      ) >= 7)
  ) {
    // Greater than 7 days, consider syncing
    // Was the last sync an error?
    if (item.get('last_sync_was_error')) {
      // If error, check if a sync has been attempted in the past week, skip if so
      if (
        !item.get('last_sync_attempt') ||
        (item.get('last_sync_attempt') &&
          Math.abs(
            differenceInDays(
              parseISO(item.get('last_sync_attempt')),
              new Date(),
            ),
          ) <= 7)
      ) {
        console.log(
          `Skipping sync for ${item.get(
            'name',
          )}, last sync attempt was an error and was less than a week ago`,
        );
      } else {
        console.log(
          `Now syncing ${item.get(
            'name',
          )}, last sync was an error and was more than a week ago`,
        );
        if (!syncJobEntries.has(item.get('id'))) {
          // Add a delay to allow other parts of the app to load before starting sync
          setTimeout(
            () => {
              if ('requestIdleCallback' in window) {
                // if requestIdleCallback is available, use it
                window.requestIdleCallback(() => handleFetchData(item), {
                  timeout: 1000 * 60,
                });
              } else {
                handleFetchData(item);
              }
            },
            2000 + Math.ceil(Math.random() * 300),
          );
        }
      }
    } else {
      console.log(
        `Now syncing ${item.get('name')}, last sync was over a week ago`,
      );
      if (!syncJobEntries.has(item.get('id'))) {
        // Add a delay to allow other parts of the app to load before starting sync
        setTimeout(
          () => {
            if ('requestIdleCallback' in window) {
              // if requestIdleCallback is available, use it
              window.requestIdleCallback(() => handleFetchData(item), {
                timeout: 1000 * 60,
              });
            } else {
              handleFetchData(item);
            }
          },
          2000 + Math.ceil(Math.random() * 300),
        );
      }
    }
  } else {
    console.log(
      `Skipping sync for ${item.get(
        'name',
      )}, last successful sync was less than a week ago`,
    );
  }
}

/**
 * A wrapping component that handles removing sync jobs from the sync job context
 * once they are complete
 */
function OnHandleUnsubscribeJobs({ children }: PropsWithChildren) {
  const sync = useSyncJobContext(),
    syncD = useSyncJobDispatchContext(),
    notifyDispatch = useNotificationDispatch(),
    syncJobs = Object.entries(sync);

  useEffect(() => {
    syncJobs.forEach(([id, j]) => {
      j.subscribe({
        next(res) {
          const successRes = res.filter((i) => i.status === 'fulfilled');
          const errors = res.filter((i) => i.status === 'rejected');

          console.group('Sync Errors:');
          errors.forEach((x) =>
            console.error((x as PromiseRejectedResult).reason),
          );
          console.groupEnd();

          if (errors.length === 0) {
            notifyDispatch({
              type: 'set_notification',
              message: `Successfully synced records`,
              variant: 'success',
            });
          } else if (
            // check if partial records were synced successfully
            successRes.length > 0 &&
            errors.length > 0
          ) {
            notifyDispatch({
              type: 'set_notification',
              message: `Some records were unable to be synced`,
              variant: 'info',
            });
          } else {
            notifyDispatch({
              type: 'set_notification',
              message: `No records were able to be synced`,
              variant: 'error',
            });
          }
        },
        error(e: Error) {
          console.error(e);
          notifyDispatch({
            type: 'set_notification',
            message: `Error syncing records: ${e.message}`,
            variant: 'error',
          });
          if (syncD) {
            syncD({ type: 'remove_job', id });
          }
        },
        complete() {
          if (syncD) {
            syncD({ type: 'remove_job', id });
          }
        },
      });
    });
  }, [notifyDispatch, syncD, syncJobs]);

  return <>{children}</>;
}

/**
 * A hook that returns the sync job context. Allows you to read the current sync jobs currenly executing
 * @returns a record of the sync job id as keys and a subject/promise of the current running job as the value
 */
export function useSyncJobContext() {
  const context = useContext(SyncJobContext);
  return context;
}

/**
 * A hook that returns the sync job dispatch function.
 * @returns a dispatch function that allows you to add/remove sync jobs
 */
export function useSyncJobDispatchContext() {
  const context = useContext(SyncJobDispatchContext);
  return context;
}

async function fetchMedicalRecords(ctx: SyncContext) {
  const { connection, db } = ctx;

  try {
    const syncJob = await syncWithVendor(ctx);
    await updateConnectionDocumentTimestamps(syncJob, connection, db);
    return syncJob;
  } catch (e) {
    console.error(e);
    await updateConnectionDocumentErrorTimestamps(connection, db);
    throw new Error(
      `Error refreshing ${connection.get(
        'name',
      )} access - try logging in again`,
    );
  }
}

/**
 * This function updates the connection document with the timestamps of the last sync attempt
 * and marks the last sync as an error. It is called when a sync operation fails.
 * @param connectionDocument The connection document to update
 * @param db The RxDB database instance where the connection document is stored
 */
async function updateConnectionDocumentErrorTimestamps(
  connectionDocument: RxDocument<AnyConnectionDocument>,
  db: RxDatabase<DatabaseCollections>,
) {
  await recordSyncError(
    db,
    connectionDocument.get('user_id'),
    connectionDocument.get('id'),
  );
}

/**
 * This function updates the timestamps in the connection document
 * If there was a successful sync, it updates the last_refreshed and last_sync_attempt
 * If there was an error, it updates the last_sync_attempt and sets last_sync_was_error to true
 * @param syncJob the sync job to check if there were any successful syncs
 * @param connectionDocument the connection document to update
 * @param db the RxDB database to update the connection document in
 */
async function updateConnectionDocumentTimestamps(
  syncJob: PromiseSettledResult<unknown>[],
  connectionDocument: RxDocument<AnyConnectionDocument>,
  db: RxDatabase<DatabaseCollections>,
) {
  const anySuccess = syncJob.some((i) => i.status === 'fulfilled');
  const userId = connectionDocument.get('user_id');
  const connectionId = connectionDocument.get('id');

  if (anySuccess) {
    await recordSyncSuccess(db, userId, connectionId);
  } else {
    await updateConnectionDocumentErrorTimestamps(connectionDocument, db);
  }
}
