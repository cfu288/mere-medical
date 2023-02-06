import React, { useRef, useContext } from 'react';
import { PropsWithChildren, useEffect, useState } from 'react';
import { RxDatabase, RxDocument } from 'rxdb';
import { Subscription } from 'rxjs';
import uuid4 from '../../utils/UUIDUtils';
import { UserDocument } from '../../models/user-document/UserDocument.type';
import { DatabaseCollections, useRxDb } from './RxDbProvider';

const defaultUser: UserDocument = {
  id: uuid4(),
  is_selected_user: true,
  is_default_user: true,
};

function fetchUsers(
  db: RxDatabase<DatabaseCollections>,
  handleChange: (
    item:
      | { user: UserDocument; rawUser: RxDocument<UserDocument> | null }
      | undefined
  ) => void
) {
  return db.user_documents
    .findOne({
      selector: {
        is_selected_user: true,
      },
    })
    .$.subscribe(async (item) => {
      handleChange({
        user: {
          ...defaultUser,
          ...item?.toMutableJSON(),
        } as UserDocument,
        rawUser: (item as unknown) as RxDocument<UserDocument> | null,
      });
    });
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
const RawUserContext = React.createContext<RxDocument<UserDocument> | null>(
  null
);

export function UserProvider(props: UserProviderProps) {
  const db = useRxDb(),
    [user, setUser] = useState<UserDocument | undefined>(undefined),
    [rawUser, setRawUser] = useState<RxDocument<UserDocument> | null>(null),
    hasRun = useRef(false);

  useEffect(() => {
    let sub: Subscription | undefined;
    if (!hasRun.current) {
      hasRun.current = true;
      createUserIfNone(db).then(() => {
        sub = fetchUsers(db, (item) => {
          if (item) {
            setUser(item.user);
            setRawUser(item.rawUser);
          }
        });
      });
    }
    return () => {
      sub?.unsubscribe();
    };
  }, [db]);

  if (user) {
    return (
      <UserContext.Provider value={user}>
        <RawUserContext.Provider value={rawUser}>
          {props.children}
        </RawUserContext.Provider>
      </UserContext.Provider>
    );
  }

  return null;
}

/**
 * Gets a parsed user document from the context, not modifiable
 * @returns
 */
export function useUser() {
  const context = useContext(UserContext);
  return context;
}

/**
 * Gets the raw user document from the context, modifiable
 * @returns The raw user document from the context, modifiable
 */
export function useRxUserDocument() {
  const context = useContext(RawUserContext);
  return context;
}
