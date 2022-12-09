import React, { useContext } from 'react';
import { PropsWithChildren, useEffect, useState } from 'react';
import { RxDatabase, RxDocument } from 'rxdb';
import uuid4 from 'uuid4';
import { UserDocument } from '../models/UserDocument';
import { DatabaseCollections, useRxDb } from './RxDbProvider';

function fetchUsers(
  db: RxDatabase<DatabaseCollections>,
  handleChange: (item: UserDocument | undefined) => void
) {
  return db.user_documents
    .findOne({
      selector: {
        is_selected_user: true,
      },
    })
    .$.subscribe((item) => handleChange(item?.toMutableJSON() as UserDocument));
}

type UserProviderProps = PropsWithChildren<unknown>;

const UserContext = React.createContext<UserDocument | undefined>(undefined);

export function UserProvider(props: UserProviderProps) {
  const db = useRxDb(),
    [user, setUser] = useState<UserDocument | undefined>(undefined);

  useEffect(() => {
    if (db) {
      fetchUsers(db, (item) => {
        if (item) {
          setUser(item);
        }
      });
    }
  }, [db]);

  return (
    <UserContext.Provider value={user}>{props.children}</UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);
  return context;
}
