/* eslint-disable react/jsx-no-useless-fragment */
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
import { RxDBQueryBuilderPlugin } from 'rxdb/plugins/query-builder';
import { ClinicalDocumentSchema } from '../../models/clinical-document/ClinicalDocument.collection';
import { ConnectionDocumentSchema } from '../../models/connection-document/ConnectionDocument.collection';
import { UserDocumentSchema } from '../../models/user-document/UserDocument.collection';
import { UserPreferencesDocumentSchema } from '../../models/user-preferences/UserPreferences.collection';
import { UserDocumentMigrations } from '../../models/user-document/UserDocument.migration';
import { UserPreferencesMigrations } from '../../models/user-preferences/UserPreferences.migration';
import { getRxStorageDexie } from 'rxdb/plugins/dexie';
import { getRxStorageLoki } from 'rxdb/plugins/lokijs';
import { ClinicalDocumentMigrations } from '../../models/clinical-document/ClinicalDocument.migration';
import { useNotificationDispatch } from './NotificationProvider';
import { ConnectionDocumentMigrations } from '../../models/connection-document/ConnectionDocument.migration';
import { getRxStorageMemory } from 'rxdb/plugins/memory';
import { AppLoadingSkeleton } from './AppLoadingSkeleton';
import { CryptedIndexedDBAdapter } from 'sylviejs/storage-adapter/crypted-indexeddb-adapter';
import logo from '../../assets/img/white-logo.svg';
import { useLocalConfig } from './LocalConfigProvider';
import { SummaryPagePreferencesSchema } from '../../models/summary-page-preferences/SummaryPagePreferences.collection';
import { SummaryPagePreferencesMigrations } from '../../models/summary-page-preferences/SummaryPagePreferences.migration';
import { DatabaseCollections } from './DatabaseCollections';
import { VectorStorageDocumentSchema } from '../../models/vector-storage-document/VectorStorageDocument.collection';
import { VectorStorageDocumentMigrations } from '../../models/vector-storage-document/VectorStorageDocument.migration';
import { USPSTFRecommendationDocumentSchema } from '../../models/uspstf-recommendation-document/USPSTFRecommendationDocument.collection';
import { InstanceConfigDocumentSchema } from '../../models/instance-config/InstanceConfig.collection';

if (process.env.NODE_ENV === 'development') {
  addRxPlugin(RxDBDevModePlugin);
}
addRxPlugin(RxDBUpdatePlugin);
addRxPlugin(RxDBMigrationPlugin);
addRxPlugin(RxDBJsonDumpPlugin);
addRxPlugin(RxDBQueryBuilderPlugin);

export const RxDbContext = React.createContext<
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
  summary_page_preferences: {
    schema: SummaryPagePreferencesSchema,
    migrationStrategies: SummaryPagePreferencesMigrations,
  },
  vector_storage: {
    schema: VectorStorageDocumentSchema,
    migrationStrategies: VectorStorageDocumentMigrations,
  },
  uspstf_recommendation_documents: {
    schema: USPSTFRecommendationDocumentSchema,
  },
  instance_config: {
    schema: InstanceConfigDocumentSchema,
    migrationStrategies: {
      1: (oldDoc: Record<string, unknown>) => oldDoc,
      2: (oldDoc: Record<string, unknown>) => oldDoc,
    },
  },
};

export function handleJSONDataImport(
  jsonString: string,
  db: RxDatabase<DatabaseCollections>,
): Promise<string> {
  return new Promise((resolve, reject) => {
    if (jsonString) {
      const data = JSON.parse(
        jsonString as string,
      ) as RxDumpDatabaseAny<DatabaseCollections>;
      Promise.all(
        Object.values(db.collections).map((col) => col?.remove()),
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
            console.group('Errors with import:');
            console.error(errors);
            console.groupEnd();
            reject(
              Error(
                `${
                  Object.keys(errors).length
                } documents were not able to be imported`,
              ),
            );
          } else {
            resolve(
              `${
                Object.keys(success).length
              } documents were successfully imported`,
            );
          }
        } catch (e) {
          console.error(e);
          reject(
            Error(
              'There was an error importing your data: ' + (e as Error).message,
            ),
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

export async function initUnencrypedRxDb() {
  const db = await createRxDatabase<DatabaseCollections>({
    name: 'mere_db',
    storage: getRxStorageDexie(),
    multiInstance: true,
    ignoreDuplicate: true,
  });
  await db.addCollections<DatabaseCollections>(databaseCollections);

  return db;
}

export async function initEncryptedRxDb(password: string) {
  const cryptedStorageAdapter = new CryptedIndexedDBAdapter({
    secret: password,
  }) as LokiPersistenceAdapter;
  try {
    // RxDB adds a .db extension to the database name, lets check it first
    await (cryptedStorageAdapter as CryptedIndexedDBAdapter).loadDatabaseAsync(
      'mere_db.db',
    );
  } catch (e) {
    console.error(e);
    if (e instanceof DOMException) {
      throw Error(
        'There was an error decrypting your records with the provided password.',
      );
    } else if (e === null) {
      // This is a new database, so we need to create it. No throw
      console.log('Creating new database');
    }
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

export async function getInternalLokiStorage(
  db: RxDatabase<DatabaseCollections>,
) {
  try {
    const internalDb = ((await db.internalStore.internals) as any)
      ?.localState as Promise<any>;
    console.log(await db.internalStore.internals);
    return (await internalDb).databaseState.database as Loki;
  } catch (e) {
    throw Error(
      'There was an error with updating encrypted database. If you have multiple tabs of Mere open, please close the other ones and try again.',
    );
  }
}

export async function getStorageAdapter(db: RxDatabase<DatabaseCollections>) {
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
  const localConfig = useLocalConfig();

  const submitPassword = (password: string) => {
    setInitialized('PROGRESS');
    try {
      initEncryptedRxDb(password)
        .then((db) => {
          setDb(db);
          setInitialized('COMPLETE');
        })
        .catch((err) => {
          console.error(err);
          setInitialized('ERROR');
          setError(
            'There was an error decrypting your records with the provided password.',
          );
        });
    } catch (e) {
      console.error(e);
      setInitialized('ERROR');
      setError(
        'There was an error decrypting your records with the provided password.',
      );
      setPassword('');
    }
  };

  useEffect(() => {
    if (IS_DEMO === 'enabled') {
      // If this is a demo instance, load the demo data
      setInitialized('PROGRESS');
      initDemoRxDb().then((db) => {
        loadDemoData(db)
          .then(() => {
            notifyDispatch({
              type: 'set_notification',
              message: `Welcome to the Mere Medical demo! We have added some test data for you. Some features are disabled while in demo mode.`,
              variant: 'success',
            });
            setDb(db);
            setInitialized('COMPLETE');
          })
          .catch((error) => {
            notifyDispatch({
              type: 'set_notification',
              message: (error as Error).message,
              variant: 'error',
            });
            setDb(db);
            setInitialized('COMPLETE');
          });
      });
    } else if (localConfig.use_encrypted_database === false) {
      // If not demo and not encrypted, load unencrypted db
      setInitialized('PROGRESS');
      initUnencrypedRxDb()
        .then((db) => {
          setDb(db);
          setInitialized('COMPLETE');
        })
        .catch((err) => {
          console.error(err);
          setInitialized('ERROR');
          setError(
            'There was an error initializing the database. Please try again.',
          );
        });
    }
    // Encrypted db is not automatically loaded, handled in submitPassword
  }, [localConfig.use_encrypted_database, notifyDispatch]);

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
        {localConfig.use_encrypted_database === true ? (
          <>
            {initialized === 'COMPLETE' ? (
              <AppLoadingSkeleton ready />
            ) : (
              <div className="bg-primary mobile-full-height flex flex-1 flex-col justify-center">
                <div className="sm:mx-auto sm:w-full sm:max-w-md">
                  <img
                    className="mx-auto h-10 w-auto"
                    src={logo}
                    alt="Mere Logo"
                  />
                </div>
                <div className="sm:max-w-[480px] mx-4 mt-10 sm:mx-auto sm:w-full">
                  <div className="rounded-md bg-white px-6 pb-10 pt-2 shadow-md sm:mx-4">
                    <h2 className="my-6 text-center text-xl font-semibold text-gray-800">
                      Enter your encryption password
                    </h2>
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
                          className="hidden text-sm font-medium leading-6 text-gray-900"
                        >
                          Password
                        </label>
                        <div className="">
                          <input
                            placeholder="Password"
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
                            className={`focus:ring-primary-600 block w-full rounded-md border-0 bg-gray-100 py-3 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-700 focus:ring-2 focus:ring-inset ${
                              password === '' ? 'italic' : ''
                            }`}
                          />
                        </div>
                      </div>
                      <div>
                        <button
                          type="submit"
                          className="bg-primary-700 hover:bg-primary-500 focus-visible:outline-primary-600 flex w-full justify-center rounded-md px-3 py-3 text-sm font-semibold leading-6 text-white shadow-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
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
          </>
        ) : (
          <AppLoadingSkeleton ready={initialized === 'COMPLETE'} />
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
