import React, {
  PropsWithChildren,
  useContext,
  useEffect,
  useState,
} from 'react';
import { RxDatabase, RxDocument } from 'rxdb';
import { Subscription } from 'rxjs';
import uuid4 from 'uuid4';
import { UserPreferencesDocument } from '../../models/user-preferences/UserPreferences';
import { DatabaseCollections, useRxDb } from './RxDbProvider';
import { useUser } from './UserProvider';

// Takes a user id and returns a default user preferences document
function createDefaultPreferences(
  user_id: string
): Partial<UserPreferencesDocument> {
  return { use_proxy: false, user_id, _id: uuid4() };
}

/**
 * Take the whole RxDocument and return a parsed version with defaults
 * @param item
 * @returns
 */
export function getUserPreferencesFromRxDocument(
  item: RxDocument<UserPreferencesDocument> | undefined,
  user_id: string
) {
  return {
    ...createDefaultPreferences(user_id),
    ...item?.toMutableJSON(),
  } as UserPreferencesDocument;
}

/**
 * Creates a user preferences document if none exists
 * @param db
 * @param user_id
 * @returns A promise that resolves to true if a new document was created, false if not
 */
function createUserPreferencesIfNone(
  db: RxDatabase<DatabaseCollections>,
  user_id: string
): Promise<boolean> {
  return new Promise((resolve, reject) => {
    db.user_preferences
      .findOne({})
      .exec()
      .then((item) => {
        if (item) {
          resolve(false);
        } else {
          db.user_preferences
            .insert(createDefaultPreferences(user_id))
            .then((x) => {
              console.log(x.toMutableJSON());
              resolve(true);
            })
            .catch(() => reject(false));
        }
      })
      .catch(() => {
        reject(false);
      });
  });
}

/**
 * Fetches the user preferences document and calls a callback whenever the document is updated. Returns a Subscription object that can be used to unsubscribe
 * @param db
 * @param user
 * @param handleChange Callback that takes the updated user preferences and updates the state
 * @returns Subscription object that can be used to unsubscribe
 */
function fetchUserPreferences(
  db: RxDatabase<DatabaseCollections>,
  user_id: string,
  handleChange: (item: UserPreferencesContextType | undefined) => void
): Subscription {
  return db.user_preferences
    .findOne({
      selector: {
        user_id: user_id,
      },
    })
    .$.subscribe((item) => {
      handleChange({
        userPreferences: getUserPreferencesFromRxDocument(
          item as unknown as RxDocument<UserPreferencesDocument>,
          user_id
        ),
        rawUserPreferences:
          item as unknown as RxDocument<UserPreferencesDocument>,
      });
    });
}

type UserPreferencesProviderProps = PropsWithChildren<unknown>;

type UserPreferencesContextType = {
  userPreferences?: UserPreferencesDocument;
  rawUserPreferences?: RxDocument<UserPreferencesDocument>;
};

const UserPreferencesContext = React.createContext<UserPreferencesContextType>({
  userPreferences: undefined,
  rawUserPreferences: undefined,
});

/**
 * To all descendents, expose the parsed user preferences (with defaults) and the the raw RxDocument for update ability
 * @param props
 * @returns
 */
export function UserPreferencesProvider(props: UserPreferencesProviderProps) {
  const db = useRxDb(),
    user = useUser(),
    [upContext, setUpContext] = useState<{
      userPreferences?: UserPreferencesDocument;
      rawUserPreferences?: RxDocument<UserPreferencesDocument>;
    }>({
      userPreferences: undefined,
      rawUserPreferences: undefined,
    });

  useEffect(() => {
    let sub: Subscription | undefined;

    createUserPreferencesIfNone(db, user._id).then(() => {
      sub = fetchUserPreferences(db, user._id, (item) => {
        setUpContext({
          userPreferences: item?.userPreferences,
          rawUserPreferences: item?.rawUserPreferences,
        });
      });
    });

    return () => {
      sub?.unsubscribe();
    };
  }, [db, user._id]);

  return (
    <UserPreferencesContext.Provider value={upContext}>
      {props.children}
    </UserPreferencesContext.Provider>
  );
}

export function useUserPreferences(): UserPreferencesContextType {
  const context = useContext(UserPreferencesContext);
  return context;
}
