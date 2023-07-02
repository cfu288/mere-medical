import React, {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
} from 'react';
import { PropsWithChildren } from 'react';
import { RxDocument, RxDatabase } from 'rxdb';
import {
  ConnectionDocument,
  EpicConnectionDocument,
  CernerConnectionDocument,
  ConnectionSources,
  VeradigmConnectionDocument,
} from '../../models/connection-document/ConnectionDocument.type';
import { DatabaseCollections, useRxDb } from './RxDbProvider';
import * as OnPatient from '../../services/OnPatient';
import * as Epic from '../../services/Epic';
import * as Cerner from '../../services/Cerner';
import * as Veradigm from '../../services/Veradigm';
import { from, Subject } from 'rxjs';
import { useNotificationDispatch } from './NotificationProvider';
import { differenceInDays, parseISO } from 'date-fns';
import Config from '../../environments/config.json';
import { useUserPreferences } from './UserPreferencesProvider';
import { useConnectionCards } from '../hooks/useConnectionCards';

type SyncJobProviderProps = PropsWithChildren<unknown>;

const SyncJobContext = React.createContext<
  Record<string, Subject<PromiseSettledResult<void[]>[]>>
>({});

const SyncJobDispatchContext = React.createContext<Dispatch | undefined>(
  undefined
);

type Action =
  | {
      type: 'add_job';
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
  action: Action
) => Record<string, Subject<PromiseSettledResult<void[]>[]>> = (
  state: Record<string, Subject<PromiseSettledResult<void[]>[]>>,
  action: Action
) => {
  switch (action.type) {
    case 'add_job': {
      const subject = new Subject<PromiseSettledResult<void[]>[]>();
      const observable = from(
        fetchMedicalRecords(
          action.connectionDocument,
          action.db,
          action.baseUrl,
          action.useProxy
        )
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

export function SyncJobProvider(props: SyncJobProviderProps) {
  const [state, dispatch] = React.useReducer(
    syncJobReducer,
    {} as Record<string, Subject<PromiseSettledResult<void[]>[]>>
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
 * if they have not been synced in the last day
 */
function HandleInitalSync({ children }: PropsWithChildren) {
  const sync = useSyncJobContext(),
    syncD = useSyncJobDispatchContext(),
    userPreferences = useUserPreferences(),
    list = useConnectionCards(),
    db = useRxDb(),
    isDemo = Config.IS_DEMO === 'enabled',
    handleFetchData = useCallback(
      (item: RxDocument<ConnectionDocument>) => {
        if (syncD && userPreferences) {
          syncD({
            type: 'add_job',
            id: item.toJSON().id,
            connectionDocument: item,
            baseUrl: item.get('location'),
            useProxy: userPreferences.use_proxy,
            db,
          });
        }
      },
      [db, syncD, userPreferences]
    ),
    hasRun = useRef(false),
    syncJobEntries = useMemo(() => new Set(Object.keys(sync)), [sync]);

  useEffect(() => {
    if (!isDemo) {
      if (list) {
        if (!hasRun.current && syncD) {
          hasRun.current = true;
          for (const item of list) {
            if (
              !item.get('last_refreshed') ||
              (item.get('last_refreshed') &&
                Math.abs(
                  differenceInDays(
                    parseISO(item.get('last_refreshed')),
                    new Date()
                  )
                ) >= 1)
            ) {
              if (!syncJobEntries.has(item.get('id'))) {
                setTimeout(
                  () => handleFetchData(item),
                  1000 + Math.ceil(Math.random() * 300)
                );
              }
            }
          }
        }
      }
    }
  }, [handleFetchData, isDemo, list, syncD, syncJobEntries]);

  return <>{children}</>;
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

          console.group('Sync Errors');
          errors.forEach((x) =>
            console.error((x as PromiseRejectedResult).reason)
          );
          console.groupEnd();

          if (errors.length === 0) {
            notifyDispatch({
              type: 'set_notification',
              message: `Successfully synced records`,
              variant: 'success',
            });
          } else {
            notifyDispatch({
              type: 'set_notification',
              message: `Some records were unable to be synced`,
              variant: 'info',
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

export function useSyncJobContext() {
  const context = useContext(SyncJobContext);
  return context;
}

export function useSyncJobDispatchContext() {
  const context = useContext(SyncJobDispatchContext);
  return context;
}

async function fetchMedicalRecords(
  connectionDocument: RxDocument<ConnectionDocument>,
  db: RxDatabase<DatabaseCollections>,
  baseUrl: string,
  useProxy = false
) {
  switch (connectionDocument.get('source') as ConnectionSources) {
    case 'onpatient': {
      return await OnPatient.syncAllRecords(
        connectionDocument.toMutableJSON(),
        db
      );
    }
    case 'epic': {
      try {
        await refreshEpicConnectionTokenIfNeeded(
          connectionDocument,
          db,
          useProxy
        );
        return await Epic.syncAllRecords(
          baseUrl,
          connectionDocument.toMutableJSON() as unknown as EpicConnectionDocument,
          db,
          useProxy
        );
      } catch (e) {
        console.error(e);
        const name = connectionDocument.get('name');
        throw new Error(
          `Error refreshing ${name} access - try logging in again`
        );
      }
    }
    case 'cerner': {
      try {
        await refreshCernerConnectionTokenIfNeeded(connectionDocument, db);
        return await Cerner.syncAllRecords(
          baseUrl,
          connectionDocument.toMutableJSON() as unknown as CernerConnectionDocument,
          db
        );
      } catch (e) {
        console.error(e);
        const name = connectionDocument.get('name');
        throw new Error(
          `Error refreshing ${name} access - try logging in again`
        );
      }
    }
    case 'veradigm': {
      try {
        return await Veradigm.syncAllRecords(
          baseUrl,
          connectionDocument.toMutableJSON() as unknown as VeradigmConnectionDocument,
          db
        );
      } catch (e) {
        console.error(e);
        const name = connectionDocument.get('name');
        throw new Error(
          `Error refreshing ${name} access - try logging in again`
        );
      }
    }
    default: {
      throw Error(
        `Cannot sync unknown source: ${connectionDocument.get('source')}`
      );
    }
  }
}

/**
 * For a connection document, if the access token is expired, refresh it and save it to the db
 * @param connectionDocument the connection document to refresh the access token for
 * @param db
 */
async function refreshCernerConnectionTokenIfNeeded(
  connectionDocument: RxDocument<ConnectionDocument>,
  db: RxDatabase<DatabaseCollections>
) {
  const nowInSeconds = Math.floor(Date.now() / 1000);
  if (connectionDocument.get('expires_in') <= nowInSeconds) {
    try {
      const baseUrl = connectionDocument.get('location'),
        refreshToken = connectionDocument.get('refresh_token'),
        tokenUri = connectionDocument.get('token_uri'),
        user = connectionDocument.get('user_id');

      const access_token_data = await Cerner.fetchAccessTokenWithRefreshToken(
        refreshToken,
        tokenUri
      );

      return await Cerner.saveConnectionToDb({
        res: access_token_data,
        cernerBaseUrl: baseUrl,
        db,
        user,
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
  connectionDocument: RxDocument<ConnectionDocument>,
  db: RxDatabase<DatabaseCollections>,
  useProxy = false
) {
  const nowInSeconds = Math.floor(Date.now() / 1000);
  if (connectionDocument.get('expires_in') <= nowInSeconds) {
    try {
      const epicUrl = connectionDocument.get('location'),
        epicName = connectionDocument.get('name'),
        clientId = connectionDocument.get('client_id'),
        epicId = connectionDocument.get('tenant_id'),
        user = connectionDocument.get('user_id');

      const access_token_data = await Epic.fetchAccessTokenUsingJWT(
        clientId,
        epicUrl,
        epicId,
        useProxy
      );

      return await Epic.saveConnectionToDb({
        res: access_token_data,
        epicUrl,
        epicName,
        db,
        epicId,
        user,
      });
    } catch (e) {
      console.error(e);
      throw new Error('Error refreshing token  - try logging in again');
    }
  }
  return Promise.resolve();
}
