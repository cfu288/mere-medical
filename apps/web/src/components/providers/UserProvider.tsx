import React, { useRef, useContext } from 'react';
import { PropsWithChildren, useEffect, useState } from 'react';
import { RxDatabase, RxDocument } from 'rxdb';
import { Subscription } from 'rxjs';
import uuid4 from '../../utils/UUIDUtils';
import { UserDocument } from '../../models/user-document/UserDocument.type';
import { useRxDb } from './RxDbProvider';
import { DatabaseCollections } from './DatabaseCollections';

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
      | undefined,
  ) => void,
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
        rawUser: item as unknown as RxDocument<UserDocument> | null,
      });
    });
}

function createUserIfNone(
  db: RxDatabase<DatabaseCollections>,
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

export async function fetchAllUsers(
  db: RxDatabase<DatabaseCollections>,
): Promise<RxDocument<UserDocument>[]> {
  return db.user_documents.find().exec();
}

export async function switchUser(
  db: RxDatabase<DatabaseCollections>,
  userId: string,
): Promise<void> {
  console.debug(`UserProvider: Switching to user ${userId}`);

  const newUser = await db.user_documents
    .findOne({
      selector: { id: userId },
    })
    .exec();

  if (!newUser) {
    throw new Error(`User not found: ${userId}`);
  }

  try {
    // Select new user first
    await newUser.update({
      $set: { is_selected_user: true },
    });

    // Then unselect the old one (select first to avoid state with no user)
    const currentUser = await db.user_documents
      .findOne({
        selector: { is_selected_user: true, id: { $ne: userId } },
      })
      .exec();

    if (currentUser) {
      await currentUser.update({
        $set: { is_selected_user: false },
      });
    }

    console.debug(`UserProvider: Successfully switched to user ${userId}`);
  } catch (error) {
    console.error('Failed to switch user:', error);
    throw new Error(
      `Failed to switch to user ${userId}: ${error instanceof Error ? error.message : 'Unknown database error'}`,
    );
  }
}

export async function createNewUser(
  db: RxDatabase<DatabaseCollections>,
  userData: Partial<UserDocument>,
): Promise<RxDocument<UserDocument>> {
  const newUser: UserDocument = {
    id: uuid4(),
    is_selected_user: false,
    is_default_user: false,
    ...userData,
  };
  return db.user_documents.insert(newUser);
}

type UserProviderProps = PropsWithChildren<unknown>;

type UserManagement = {
  allUsers: RxDocument<UserDocument>[];
  switchUser: (userId: string) => Promise<void>;
  createNewUser: (
    userData: Partial<UserDocument>,
  ) => Promise<RxDocument<UserDocument>>;
};

const UserContext = React.createContext<UserDocument>(defaultUser);
const RawUserContext = React.createContext<RxDocument<UserDocument> | null>(
  null,
);
const AllUsersContext = React.createContext<RxDocument<UserDocument>[]>([]);
const UserManagementContext = React.createContext<UserManagement | null>(null);

export function UserProvider(props: UserProviderProps) {
  const db = useRxDb(),
    [user, setUser] = useState<UserDocument | undefined>(undefined),
    [rawUser, setRawUser] = useState<RxDocument<UserDocument> | null>(null),
    [allUsers, setAllUsers] = useState<RxDocument<UserDocument>[]>([]),
    hasRun = useRef(false);

  useEffect(() => {
    let userSub: Subscription | undefined;
    let allUsersSub: Subscription | undefined;

    if (!hasRun.current) {
      hasRun.current = true;
      createUserIfNone(db).then(() => {
        // Subscribe to current selected user
        userSub = fetchUsers(db, (item) => {
          if (item) {
            setUser(item.user);
            setRawUser(item.rawUser);
          }
        });

        // Subscribe to all users
        allUsersSub = db.user_documents.find().$.subscribe((users) => {
          setAllUsers(users as RxDocument<UserDocument>[]);
        });
      });
    }
    return () => {
      userSub?.unsubscribe();
      allUsersSub?.unsubscribe();
    };
  }, [db]);

  const userManagement: UserManagement = {
    allUsers,
    switchUser: async (userId: string) => {
      await switchUser(db, userId);
    },
    createNewUser: async (userData: Partial<UserDocument>) => {
      return createNewUser(db, userData);
    },
  };

  if (user) {
    return (
      <UserContext.Provider value={user}>
        <RawUserContext.Provider value={rawUser}>
          <AllUsersContext.Provider value={allUsers}>
            <UserManagementContext.Provider value={userManagement}>
              {props.children}
            </UserManagementContext.Provider>
          </AllUsersContext.Provider>
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

/**
 * Gets all users from the context
 * @returns All user documents
 */
export function useAllUsers() {
  const context = useContext(AllUsersContext);
  return context;
}

/**
 * Gets user management functions
 * @returns User management functions
 */
export function useUserManagement() {
  const context = useContext(UserManagementContext);
  if (!context) {
    throw new Error('useUserManagement must be used within a UserProvider');
  }
  return context;
}
