import React, {
  PropsWithChildren,
  useContext,
  useEffect,
  useState,
} from "react";
import PouchDB from "pouchdb";
import PouchDBFind from "pouchdb-find";

PouchDB.plugin(PouchDBFind);

const PouchDbContext = React.createContext<PouchDB.Database | undefined>(
  undefined
);

type PouchDbProviderProps = PropsWithChildren<{}>;

async function initDb() {
  const db = new PouchDB("test");
  await db.createIndex({
    index: {
      // bug: https://github.com/pouchdb/pouchdb/issues/6399#issuecomment-312827943
      fields: ["metadata.date", "type", "metadata.id"],
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
    <>
      {db ? (
        <PouchDbContext.Provider value={db}>
          {props.children}
        </PouchDbContext.Provider>
      ) : (
        <>LOADING DB</>
      )}
    </>
  );
}

export function usePouchDb() {
  const context = useContext(PouchDbContext);
  if (context === undefined) {
    throw new Error("usePouchDb must be used within a PouchDbProvider");
  }
  return context;
}
