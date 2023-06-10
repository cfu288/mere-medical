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
import { ClinicalDocumentMigrations } from '../../models/clinical-document/ClinicalDocument.migration';
import Config from '../../environments/config.json';
import { useNotificationDispatch } from './NotificationProvider';
import { ConnectionDocumentMigrations } from '../../models/connection-document/ConnectionDocument.migration';
import { getRxStorageMemory } from 'rxdb/plugins/memory';
import { AppLoadingSkeleton } from './AppLoadingSkeleton';

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

async function initRxDb() {
  const db = await createRxDatabase<DatabaseCollections>({
    name: 'mere_db',
    storage:
      Config.IS_DEMO === 'enabled' ? getRxStorageMemory() : getRxStorageDexie(),
    multiInstance: true,
    ignoreDuplicate: true,
  });
  await db.addCollections<DatabaseCollections>(databaseCollections);

  return db;
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

  useEffect(() => {
    initRxDb().then((db) => {
      if (Config.IS_DEMO === 'enabled') {
        loadDemoData(db)
          .then(() => {
            notifyDispatch({
              type: 'set_notification',
              message: `Welcome to the XPC Hackathon demo! We have added some test data for you. Some features are disabled while in demo mode.`,
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
      } else {
        setDb(db);
      }
    });
  }, [notifyDispatch]);

  return (
    <>
      {/* Transition added to avoid flash of white  */}
      <Transition
        show={!db}
        appear={true}
        enter="transition-opacity duration-150"
        enterFrom="opacity-0"
        enterTo="opacity-100"
        leave="transition-opacity ease-linear duration-75"
        leaveFrom="opacity-100"
        leaveTo="opacity-[.99]"
      >
        <AppLoadingSkeleton ready={!db} />
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
