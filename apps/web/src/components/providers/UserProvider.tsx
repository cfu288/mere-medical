import React, { useContext } from 'react';
import { PropsWithChildren, useEffect, useState } from 'react';
import { RxDatabase } from 'rxdb';
import { Subscription } from 'rxjs';
import uuid4 from 'uuid4';
import { UserDocument } from '../../models/user-document/UserDocumentType';
import { DatabaseCollections, useRxDb } from './RxDbProvider';

const defaultUser: UserDocument = {
  _id: uuid4(),
  is_selected_user: true,
  is_default_user: true,
};

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
    .$.subscribe((item) =>
      handleChange({ ...defaultUser, ...item?.toMutableJSON() } as UserDocument)
    );
}

function createUserIfNone(
  db: RxDatabase<DatabaseCollections>
): Promise<boolean> {
  return new Promise((resolve, reject) => {
    db.user_documents
      .findOne({})
      .exec()
      .then((item) => {
        if (item) {
          resolve(false);
        } else {
          db.user_documents
            .insert(defaultUser)
            .then(() => resolve(true))
            .catch(() => reject(false));
        }
      })
      .catch(() => {
        reject(false);
      });
  });
}

type UserProviderProps = PropsWithChildren<unknown>;

const UserContext = React.createContext<UserDocument>(defaultUser);

export function UserProvider(props: UserProviderProps) {
  const db = useRxDb(),
    [user, setUser] = useState<UserDocument>(defaultUser);

  useEffect(() => {
    let sub: Subscription | undefined;

    createUserIfNone(db).then(() => {
      sub = fetchUsers(db, (item) => {
        if (item) {
          setUser(item);
        }
      });
    });

    return () => {
      sub?.unsubscribe();
    };
  }, [db]);

  if (user) {
    return (
      <UserContext.Provider value={user}>{props.children}</UserContext.Provider>
    );
  }

  return null;
}

export function useUser() {
  const context = useContext(UserContext);
  return context;
}
