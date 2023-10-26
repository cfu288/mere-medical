import React, {
  PropsWithChildren,
  useContext,
  useEffect,
  useState,
} from 'react';
import {
  addRxPlugin,
  createRxDatabase,
  RxDatabase,
  RxDocument,
  RxDumpDatabaseAny,
} from 'rxdb';
import { Transition } from '@headlessui/react';
import { RxDBDevModePlugin } from 'rxdb/plugins/dev-mode';
import { RxDBMigrationPlugin } from 'rxdb/plugins/migration';
import { RxDBJsonDumpPlugin } from 'rxdb/plugins/json-dump';
import { RxDBUpdatePlugin } from 'rxdb/plugins/update';
import {
  ClinicalDocumentCollection,
  ClinicalDocumentSchema,
} from '../../models/clinical-document/ClinicalDocument.collection';
import {
  ConnectionDocumentCollection,
  ConnectionDocumentSchema,
} from '../../models/connection-document/ConnectionDocument.collection';
import {
  UserDocumentCollection,
  UserDocumentSchema,
} from '../../models/user-document/UserDocument.collection';
import {
  UserPreferencesDocumentCollection,
  UserPreferencesDocumentSchema,
} from '../../models/user-preferences/UserPreferences.collection';
import { UserDocumentMigrations } from '../../models/user-document/UserDocument.migration';
import { UserPreferencesMigrations } from '../../models/user-preferences/UserPreferences.migration';
import { getRxStorageDexie } from 'rxdb/plugins/dexie';
import { getRxStorageLoki } from 'rxdb/plugins/lokijs';
import { ClinicalDocumentMigrations } from '../../models/clinical-document/ClinicalDocument.migration';
import Config from '../../environments/config.json';
import { useNotificationDispatch } from './NotificationProvider';
import { ConnectionDocumentMigrations } from '../../models/connection-document/ConnectionDocument.migration';
import { getRxStorageMemory } from 'rxdb/plugins/memory';
import { AppLoadingSkeleton } from './AppLoadingSkeleton';
import { CryptedIndexedDBAdapter } from 'sylviejs/storage-adapter/crypted-indexeddb-adapter';
import logo from '../../img/white-logo.svg';

// @ts-ignore
window.__loki_idb_debug = true;

if (process.env.NODE_ENV === 'development') {
  addRxPlugin(RxDBDevModePlugin);
}
addRxPlugin(RxDBUpdatePlugin);
addRxPlugin(RxDBMigrationPlugin);
addRxPlugin(RxDBJsonDumpPlugin);

export type DatabaseCollections = {
  clinical_documents: ClinicalDocumentCollection;
  connection_documents: ConnectionDocumentCollection;
  user_documents: UserDocumentCollection;
  user_preferences: UserPreferencesDocumentCollection;
};

const RxDbContext = React.createContext<
  RxDatabase<DatabaseCollections> | undefined
>(undefined);

type RxDbProviderProps = PropsWithChildren<unknown>;

export const databaseCollections = {
  clinical_documents: {
    schema: ClinicalDocumentSchema,
    migrationStrategies: ClinicalDocumentMigrations,
  },
  connection_documents: {
    schema: ConnectionDocumentSchema,
    migrationStrategies: ConnectionDocumentMigrations,
  },
  user_documents: {
    schema: UserDocumentSchema,
    migrationStrategies: UserDocumentMigrations,
  },
  user_preferences: {
    schema: UserPreferencesDocumentSchema,
    migrationStrategies: UserPreferencesMigrations,
  },
};

export function handleJSONDataImport(
  jsonString: string,
  db: RxDatabase<DatabaseCollections>
): Promise<string> {
  return new Promise((resolve, reject) => {
    if (jsonString) {
      const data = JSON.parse(
        jsonString as string
      ) as RxDumpDatabaseAny<DatabaseCollections>;
      Promise.all(
        Object.values(db.collections).map((col) => col?.remove())
      ).then(async () => {
        await db.addCollections<DatabaseCollections>(databaseCollections);
        try {
          const i = db.importJSON(data);
          const res = i as unknown as Promise<
            {
              error: Record<string, RxDocument>;
              success: Record<string, RxDocument>;
            }[]
          >;
          let errors = {};
          let success = {};

          (await res).forEach((item) => {
            errors = { ...errors, ...item.error };
            success = { ...success, ...item.success };
          });

          if (Object.keys(errors).length > 0) {
            console.group('There were some errors with import:');
            console.error(errors);
            console.groupEnd();
            reject(
              Error(
                `${
                  Object.keys(errors).length
                } documents were not able to be imported`
              )
            );
          } else {
            resolve(
              `${
                Object.keys(success).length
              } documents were successfully imported`
            );
          }
        } catch (e) {
          console.error(e);
          reject(
            Error(
              'There was an error importing your data: ' + (e as Error).message
            )
          );
        }
      });
    }
  });
}

async function initDemoRxDb() {
  const db = await createRxDatabase<DatabaseCollections>({
    name: 'mere_db',
    storage: getRxStorageMemory(),
    multiInstance: true,
    ignoreDuplicate: true,
  });
  await db.addCollections<DatabaseCollections>(databaseCollections);

  return db;
}

async function initRxDb(password: string) {
  const cryptedStorageAdapter = new CryptedIndexedDBAdapter({
    secret: password,
  }) as LokiPersistenceAdapter;

  try {
    // RxDB adds a .db extension to the database name, lets check it first
    await (cryptedStorageAdapter as CryptedIndexedDBAdapter).loadDatabaseAsync(
      'mere_db.db'
    );
  } catch (e) {
    console.error(e);
    throw Error(
      'There was an error decrypting your records with the provided password.'
    );
  }

  // Password has been validated - create the db
  const db = await createRxDatabase<DatabaseCollections>({
    name: 'mere_db',
    storage: getRxStorageLoki({
      adapter: cryptedStorageAdapter as LokiPersistenceAdapter,
    }),
    multiInstance: true,
    ignoreDuplicate: true,
  });

  await db.addCollections<DatabaseCollections>(databaseCollections);

  return db;
}

async function getInternalLokiStorage(db: RxDatabase<DatabaseCollections>) {
  const internalDb = (
    (await db.clinical_documents.storageInstance.internals) as any
  )?.localState;
  return internalDb.databaseState.database as Loki;
}

async function getStorageAdapter(db: RxDatabase<DatabaseCollections>) {
  const internalDb = await getInternalLokiStorage(db);
  return internalDb?.persistenceAdapter as LokiPersistenceAdapter;
}

async function loadDemoData(db: RxDatabase<DatabaseCollections>) {
  const data = await fetch('/assets/demo.json');
  const json = await data.json();
  const message = await handleJSONDataImport(JSON.stringify(json), db);
  return message;
}

export function RxDbProvider(props: RxDbProviderProps) {
  const [db, setDb] = useState<RxDatabase<DatabaseCollections>>();
  const notifyDispatch = useNotificationDispatch();
  const [password, setPassword] = useState<string>('');
  const [initialized, setInitialized] = useState<
    'IDLE' | 'PROGRESS' | 'COMPLETE' | 'ERROR'
  >('IDLE');
  const [error, setError] = useState<string>('');

  const submitPassword = (password: string) => {
    console.log(password);
    setInitialized('PROGRESS');
    try {
      initRxDb(password)
        .then((db) => {
          console.log(1);
          setDb(db);
          setInitialized('COMPLETE');
        })
        .catch((err) => {
          console.log(2);
          console.error(err);
          setInitialized('ERROR');
          setError(
            'Caught: There was an error decrypting your records with the provided password.'
          );
        });
    } catch (e) {
      setInitialized('ERROR');
      setError(
        'Uncaught Error: There was an error decrypting your records with the provided password.'
      );
      setPassword('');
    }
  };

  useEffect(() => {
    if (Config.IS_DEMO === 'enabled') {
      initDemoRxDb().then((db) => {
        loadDemoData(db)
          .then(() => {
            notifyDispatch({
              type: 'set_notification',
              message: `Welcome to the Mere Medical demo! We have added some test data for you. Some features are disabled while in demo mode.`,
              variant: 'success',
            });
            setDb(db);
          })
          .catch((error) => {
            notifyDispatch({
              type: 'set_notification',
              message: (error as Error).message,
              variant: 'error',
            });
            setDb(db);
          });
      });
    }
  }, [notifyDispatch]);

  return (
    <>
      {/* Transition added to avoid flash of white  */}
      <Transition
        show={initialized !== 'COMPLETE'}
        appear={true}
        enter="transition-opacity duration-150"
        enterFrom="opacity-0"
        enterTo="opacity-100"
        leave="transition-opacity ease-linear duration-75"
        leaveFrom="opacity-100"
        leaveTo="opacity-[.99]"
      >
        {initialized === 'COMPLETE' ? (
          <AppLoadingSkeleton ready={initialized === 'COMPLETE'} />
        ) : (
          <div className="bg-primary-900 flex min-h-screen flex-1 flex-col justify-center px-6 py-12 lg:px-8">
            <div className="sm:mx-auto sm:w-full sm:max-w-md">
              <img className="mx-auto h-10 w-auto" src={logo} alt="Mere Logo" />
              <h2 className="mt-6 text-center text-2xl font-bold leading-9 tracking-tight text-white">
                Enter your encryption password
              </h2>
            </div>

            <div className="mt-10 sm:mx-auto sm:w-full sm:max-w-[480px]">
              <div className="bg-white px-6 py-12 shadow sm:rounded-lg sm:px-12">
                <form
                  className="space-y-6"
                  onSubmit={(e) => {
                    e.preventDefault();
                    submitPassword(password);
                  }}
                >
                  <div>
                    <label
                      htmlFor="password"
                      className="block text-sm font-medium leading-6 text-gray-900"
                    >
                      Password
                    </label>
                    <div className="">
                      <input
                        id="password"
                        name="password"
                        type="password"
                        autoComplete="current-password"
                        required
                        value={password}
                        onChange={(e) => {
                          setPassword(e.target.value);
                          initialized === 'ERROR' && setInitialized('IDLE');
                        }}
                        className="focus:ring-primary-600 block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset sm:text-sm sm:leading-6"
                      />
                    </div>
                  </div>

                  <div>
                    <button
                      type="submit"
                      className="bg-primary-600 hover:bg-primary-500 focus-visible:outline-primary-600 flex w-full justify-center rounded-md px-3 py-1.5 text-sm font-semibold leading-6 text-white shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                    >
                      Unlock
                    </button>
                  </div>
                  {/* error message */}
                  {initialized === 'ERROR' && (
                    <div className="text-center text-red-500">{error}</div>
                  )}
                </form>
              </div>
            </div>
          </div>
        )}
      </Transition>
      {db && (
        <RxDbContext.Provider value={db}>{props.children}</RxDbContext.Provider>
      )}
    </>
  );
}

export function useRxDb() {
  const context = useContext(RxDbContext);
  if (context === undefined) {
    throw new Error('useRxDb must be used within a RxDbProvider');
  }
  return context;
}
