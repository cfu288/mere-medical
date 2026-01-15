import React, { useCallback, useContext, useEffect, useMemo } from 'react';
import { PropsWithChildren } from 'react';
import { RxDocument, RxDatabase } from 'rxdb';
import {
  ConnectionDocument,
  EpicConnectionDocument,
  CernerConnectionDocument,
  ConnectionSources,
  VeradigmConnectionDocument,
  VAConnectionDocument,
} from '../../models/connection-document/ConnectionDocument.type';
import { useRxDb } from '../../app/providers/RxDbProvider';
import { DatabaseCollections } from '../../app/providers/DatabaseCollections';
import * as OnPatient from '../../services/fhir/OnPatient';
import * as Epic from '../../services/fhir/Epic';
import * as Cerner from '../../services/fhir/Cerner';
import * as Veradigm from '../../services/fhir/Veradigm';
import * as VA from '../../services/fhir/VA';
import { from, Subject } from 'rxjs';
import { useNotificationDispatch } from '../../app/providers/NotificationProvider';
import { differenceInDays, parseISO } from 'date-fns';
import {
  AppConfig,
  useAppConfig,
  isConfigValid,
} from '../../app/providers/AppConfigProvider';
import { useUserPreferences } from '../../app/providers/UserPreferencesProvider';
import { useConnectionCards } from '../connections/hooks/useConnectionCards';
import { findUserById } from '../../repositories/UserRepository';
import { refreshVAConnectionTokenIfNeeded } from '../../services/fhir/VA';
import { upsertConnection } from '../../repositories/ConnectionRepository';
import {
  recordSyncSuccess,
  recordSyncError,
} from '../../services/fhir/ConnectionService';

type SyncJobProviderProps = PropsWithChildren<unknown>;

const SyncJobContext = React.createContext<
  Record<string, Subject<PromiseSettledResult<void[]>[]>>
>({});

const SyncJobDispatchContext = React.createContext<Dispatch | undefined>(
  undefined,
);

type Action =
  | {
      type: 'add_job';
      config: AppConfig;
      id: string;
      connectionDocument: RxDocument<ConnectionDocument>;
      baseUrl: string;
      useProxy: boolean;
      db: RxDatabase<DatabaseCollections>;
    }
  | { type: 'remove_job'; id: string };

type Dispatch = (action: Action) => void;

const syncJobReducer: (
  state: Record<string, Subject<PromiseSettledResult<void[]>[]>>,
  action: Action,
) => Record<string, Subject<PromiseSettledResult<void[]>[]>> = (
  state: Record<string, Subject<PromiseSettledResult<void[]>[]>>,
  action: Action,
) => {
  switch (action.type) {
    case 'add_job': {
      const subject = new Subject<PromiseSettledResult<void[]>[]>();
      const observable = from(
        fetchMedicalRecords(
          action.config,
          action.connectionDocument,
          action.db,
          action.baseUrl,
          action.useProxy,
        ),
      );
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
    {} as Record<string, Subject<PromiseSettledResult<void[]>[]>>,
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
      (item: RxDocument<ConnectionDocument>) => {
        if (syncD && userPreferences) {
          syncD({
            type: 'add_job',
            config,
            id: item.toJSON().id,
            connectionDocument: item,
            baseUrl: item.get('location'),
            useProxy: userPreferences.use_proxy,
            db,
          });
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
  item: RxDocument<ConnectionDocument>,
  syncJobEntries: Set<string>,
  handleFetchData: (item: RxDocument<ConnectionDocument>) => void,
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

async function fetchMedicalRecords(
  config: AppConfig,
  connectionDocument: RxDocument<ConnectionDocument>,
  db: RxDatabase<DatabaseCollections>,
  baseUrl: string,
  useProxy = false,
) {
  switch (connectionDocument.get('source') as ConnectionSources) {
    case 'onpatient': {
      try {
        const syncJob = await OnPatient.syncAllRecords(
          connectionDocument.toMutableJSON(),
          db,
        );
        await updateConnectionDocumentTimestamps(
          syncJob,
          connectionDocument,
          db,
        );
        return syncJob;
      } catch (e) {
        console.error(e);
        await updateConnectionDocumentErrorTimestamps(connectionDocument, db);
        throw new Error(
          `Error refreshing ${connectionDocument.get(
            'name',
          )} access - try logging in again`,
        );
      }
    }
    case 'epic': {
      try {
        await refreshEpicConnectionTokenIfNeeded(
          config,
          connectionDocument,
          db,
          useProxy,
        );
        const syncJob = await Epic.syncAllRecords(
          config,
          baseUrl,
          connectionDocument.toMutableJSON() as unknown as EpicConnectionDocument,
          db,
          useProxy,
        );
        await updateConnectionDocumentTimestamps(
          syncJob,
          connectionDocument,
          db,
        );
        return syncJob;
      } catch (e) {
        console.error(e);
        await updateConnectionDocumentErrorTimestamps(connectionDocument, db);
        throw new Error(
          `Error refreshing ${connectionDocument.get(
            'name',
          )} access - try logging in again`,
        );
      }
    }
    case 'cerner': {
      try {
        await refreshCernerConnectionTokenIfNeeded(connectionDocument, db);
        const cernerConnection =
          connectionDocument.toMutableJSON() as unknown as CernerConnectionDocument;
        const syncJob = await Cerner.syncAllRecords(
          baseUrl,
          cernerConnection,
          db,
          cernerConnection.fhir_version ?? 'DSTU2',
        );
        await updateConnectionDocumentTimestamps(
          syncJob,
          connectionDocument,
          db,
        );
        return syncJob;
      } catch (e) {
        console.error(e);
        await updateConnectionDocumentErrorTimestamps(connectionDocument, db);
        throw new Error(
          `Error refreshing ${connectionDocument.get(
            'name',
          )} access - try logging in again`,
        );
      }
    }
    case 'va': {
      try {
        await refreshVAConnectionTokenIfNeeded(connectionDocument, db);
        const syncJob = await VA.syncAllRecords(
          baseUrl,
          connectionDocument.toMutableJSON() as unknown as VAConnectionDocument,
          db,
        );
        await updateConnectionDocumentTimestamps(
          syncJob,
          connectionDocument,
          db,
        );
        return syncJob;
      } catch (e) {
        console.error(e);
        await updateConnectionDocumentErrorTimestamps(connectionDocument, db);
        throw new Error(
          `Error refreshing ${connectionDocument.get(
            'name',
          )} access - try logging in again`,
        );
      }
    }
    case 'veradigm': {
      try {
        const syncJob = await Veradigm.syncAllRecords(
          baseUrl,
          connectionDocument.toMutableJSON() as unknown as VeradigmConnectionDocument,
          db,
        );
        await updateConnectionDocumentTimestamps(
          syncJob,
          connectionDocument,
          db,
        );
        return syncJob;
      } catch (e) {
        console.error(e);
        await updateConnectionDocumentErrorTimestamps(connectionDocument, db);
        throw new Error(
          `Error refreshing ${connectionDocument.get(
            'name',
          )} access - try logging in again`,
        );
      }
    }

    default: {
      throw Error(
        `Cannot sync unknown source: ${connectionDocument.get('source')}`,
      );
    }
  }
}

/**
 * This function updates the connection document with the timestamps of the last sync attempt
 * and marks the last sync as an error. It is called when a sync operation fails.
 * @param connectionDocument The connection document to update
 * @param db The RxDB database instance where the connection document is stored
 */
async function updateConnectionDocumentErrorTimestamps(
  connectionDocument: RxDocument<ConnectionDocument>,
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
  syncJob: PromiseSettledResult<void[]>[],
  connectionDocument: RxDocument<ConnectionDocument>,
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

/**
 * For a connection document, if the access token is expired, refresh it and save it to the db
 * @param connectionDocument the connection document to refresh the access token for
 * @param db
 */
async function refreshCernerConnectionTokenIfNeeded(
  connectionDocument: RxDocument<ConnectionDocument>,
  db: RxDatabase<DatabaseCollections>,
) {
  const nowInSeconds = Math.floor(Date.now() / 1000);
  if (connectionDocument.get('source') !== 'cerner') {
    return Promise.reject(
      new Error(
        `Cannot refresh connection token for source: ${connectionDocument.get(
          'source',
        )}, expected 'cerner'`,
      ),
    );
  }
  if (connectionDocument.get('expires_at') <= nowInSeconds) {
    try {
      const baseUrl = connectionDocument.get('location'),
        refreshToken = connectionDocument.get('refresh_token'),
        tokenUri = connectionDocument.get('token_uri'),
        userId = connectionDocument.get('user_id');

      // Fetch the actual UserDocument from the database
      const userObject = await findUserById(db, userId);

      if (!userObject) {
        throw new Error(`User not found: ${userId}`);
      }

      const access_token_data = await Cerner.fetchAccessTokenWithRefreshToken(
        refreshToken,
        tokenUri,
      );

      return await Cerner.saveConnectionToDb({
        res: access_token_data,
        cernerBaseUrl: baseUrl,
        db,
        user: userObject,
      });
    } catch (e) {
      console.error(e);
      throw new Error('Error refreshing token  - try logging in again');
    }
  }
  return Promise.resolve();
}

/**
 * For a connection document, if the access token is expired, refresh it and save it to the db
 * @param connectionDocument the connection document to refresh the access token for
 * @param db
 */
async function refreshEpicConnectionTokenIfNeeded(
  config: AppConfig,
  connectionDocument: RxDocument<ConnectionDocument>,
  db: RxDatabase<DatabaseCollections>,
  useProxy = false,
) {
  const nowInSeconds = Math.floor(Date.now() / 1000);
  if (connectionDocument.get('source') !== 'epic') {
    return Promise.reject(
      new Error(
        `Cannot refresh connection token for source: ${connectionDocument.get(
          'source',
        )}, expected 'epic'`,
      ),
    );
  }
  if (connectionDocument.get('expires_at') <= nowInSeconds) {
    try {
      const epicBaseUrl = connectionDocument.get('location'),
        epicName = connectionDocument.get('name'),
        epicAuthUrl = connectionDocument.get('auth_uri'),
        epicTokenUrl = connectionDocument.get('token_uri'),
        clientId = connectionDocument.get('client_id'),
        epicId = connectionDocument.get('tenant_id'),
        userId = connectionDocument.get('user_id');

      // Fetch the actual UserDocument from the database
      const userObject = await findUserById(db, userId);

      if (!userObject) {
        throw new Error(`User not found: ${userId}`);
      }

      const access_token_data = await Epic.fetchAccessTokenUsingJWT(
        config,
        clientId,
        epicTokenUrl,
        epicId,
        useProxy,
      );

      return await Epic.saveConnectionToDb({
        res: access_token_data,
        epicBaseUrl,
        epicTokenUrl,
        epicAuthUrl,
        epicName,
        db,
        epicId,
        user: userObject,
      });
    } catch (e) {
      console.error(e);
      throw new Error('Error refreshing token  - try logging in again');
    }
  }
  return Promise.resolve();
}
