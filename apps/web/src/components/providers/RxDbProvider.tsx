import React, {
  PropsWithChildren,
  useContext,
  useEffect,
  useState,
} from 'react';
import logo from '../../assets/logo.svg';
import { addRxPlugin, createRxDatabase, RxDatabase } from 'rxdb';
import { Transition } from '@headlessui/react';
import {
  getRxStoragePouch,
  addPouchPlugin,
  RxStoragePouchStatics,
} from 'rxdb/plugins/pouchdb';
import plugin from 'pouchdb-adapter-idb';

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
import { RxDBAttachmentsPlugin } from 'rxdb/plugins/attachments';
import { UserPreferencesMigrations } from '../../models/user-preferences/UserPreferences.migration';
import { getRxStorageWorker } from 'rxdb/plugins/worker';
import { getRxStorageDexie, RxStorageDexieStatics } from 'rxdb/plugins/dexie';

addRxPlugin(RxDBUpdatePlugin);
addRxPlugin(RxDBMigrationPlugin);
addRxPlugin(RxDBAttachmentsPlugin);
addRxPlugin(RxDBDevModePlugin);
addRxPlugin(RxDBJsonDumpPlugin);

addPouchPlugin(plugin);

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

async function initRxDb() {
  const db = await createRxDatabase<DatabaseCollections>({
    name: 'mere_db',
    // storage: getRxStoragePouch('idb'),
    // storage: getRxStorageDexie(),
    storage: getRxStorageWorker({
      statics: RxStorageDexieStatics,
      workerInput: '../../assets/dexie.worker.js',
    }),
    multiInstance: true,
    ignoreDuplicate: true,
  });
  await db.addCollections<DatabaseCollections>({
    clinical_documents: {
      schema: ClinicalDocumentSchema,
    },
    connection_documents: {
      schema: ConnectionDocumentSchema,
    },
    user_documents: {
      schema: UserDocumentSchema,
      migrationStrategies: UserDocumentMigrations,
    },
    user_preferences: {
      schema: UserPreferencesDocumentSchema,
      migrationStrategies: UserPreferencesMigrations,
    },
  });

  return db;
}

export function RxDbProvider(props: RxDbProviderProps) {
  const [db, setDb] = useState<RxDatabase<DatabaseCollections>>();

  useEffect(() => {
    initRxDb().then((db) => {
      setDb(db);
    });
  }, []);

  return (
    <>
      <Transition
        show={!!db}
        enter="transition-opacity ease-linear duration-150"
        enterFrom="opacity-0"
        enterTo="opacity-100"
        leave="transition-opacity ease-linear duration-150"
        leaveFrom="opacity-100"
        leaveTo="opacity-0"
      >
        <RxDbContext.Provider value={db}>{props.children}</RxDbContext.Provider>
      </Transition>
      <Transition
        show={!db}
        leave="transition-opacity ease-linear duration-150"
        leaveFrom="opacity-0"
        leaveTo="opacity-100"
        enter="transition-opacity ease-linear duration-150"
        enterFrom="opacity-100"
        enterTo="opacity-0"
      >
        <div className="z-20 flex h-screen w-full flex-col items-center justify-center gap-8">
          <img className="h-48 w-48" src={logo} alt="Loading screen"></img>
        </div>
      </Transition>
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
