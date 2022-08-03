import React, {
  PropsWithChildren,
  useContext,
  useEffect,
  useState,
} from 'react';
import PouchDB from 'pouchdb';
import PouchDBFind from 'pouchdb-find';
import logo from '../assets/logo.svg';
import { Transition } from '@headlessui/react';

PouchDB.plugin(PouchDBFind);

const PouchDbContext = React.createContext<PouchDB.Database | undefined>(
  undefined
);

type PouchDbProviderProps = PropsWithChildren<{}>;

async function initDb() {
  const db = new PouchDB('test');
  await db.createIndex({
    index: {
      // bug: https://github.com/pouchdb/pouchdb/issues/6399#issuecomment-312827943
      fields: ['metadata.date', 'type', 'metadata.id'],
    },
  });
  return db;
}

export function PouchDbProvider(props: PouchDbProviderProps) {
  const [db, setDb] = useState<PouchDB.Database<{}>>();

  useEffect(() => {
    initDb().then((db) => {
      setDb(db);
    });
  }, []);

  return (
    <Transition show={!!db}>
      <Transition.Child
        leave="transition-opacity ease-linear duration-150"
        leaveFrom="opacity-0"
        leaveTo="opacity-100"
        enter="transition-opacity ease-linear duration-150"
        enterFrom="opacity-100"
        enterTo="opacity-0"
      >
        <div className="flex flex-col h-screen w-full justify-center items-center gap-8">
          <img className="w-48 h-48" src={logo} alt="Loading screen"></img>
        </div>
      </Transition.Child>
      <Transition.Child
        enter="transition-opacity ease-linear duration-150"
        enterFrom="opacity-0"
        enterTo="opacity-100"
        leave="transition-opacity ease-linear duration-150"
        leaveFrom="opacity-100"
        leaveTo="opacity-0"
      >
        <PouchDbContext.Provider value={db}>
          {props.children}
        </PouchDbContext.Provider>
      </Transition.Child>
    </Transition>
  );
}

export function usePouchDb() {
  const context = useContext(PouchDbContext);
  if (context === undefined) {
    // throw new Error('usePouchDb must be used within a PouchDbProvider');
  }
  return context as unknown as PouchDB.Database<{}>;
}
