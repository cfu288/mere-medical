import React, {
  PropsWithChildren,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { RxDatabase, RxDocument } from 'rxdb';
import { Subscription } from 'rxjs';
import uuid4 from '../../utils/UUIDUtils';
import { UserPreferencesDocument } from '../../models/user-preferences/UserPreferences.type';
import { DatabaseCollections, useRxDb } from './RxDbProvider';
import { useUser } from './UserProvider';

// Takes a user id and returns a default user preferences document
function createDefaultPreferences(
  user_id: string
): Partial<UserPreferencesDocument> {
  return { use_proxy: true, user_id, id: uuid4() };
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
      .findOne({
        selector: {
          user_id: user_id,
        },
      })
      .exec()
      .then((item) => {
        if (item) {
          resolve(false);
        } else {
          db.user_preferences
            .insert(createDefaultPreferences(user_id))
            .then(() => resolve(true))
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
      console.log(item?.toMutableJSON());
      handleChange({
        userPreferences: getUserPreferencesFromRxDocument(
          (item as unknown) as RxDocument<UserPreferencesDocument>,
          user_id
        ),
        rawUserPreferences: (item as unknown) as RxDocument<UserPreferencesDocument>,
      });
    });
}

type UserPreferencesProviderProps = PropsWithChildren<unknown>;

type UserPreferencesContextType = {
  userPreferences?: UserPreferencesDocument;
  rawUserPreferences?: RxDocument<UserPreferencesDocument>;
};

const UserPreferencesContext = React.createContext<
  UserPreferencesDocument | undefined
>(undefined);

const RawUserPreferencesContext = React.createContext<
  RxDocument<UserPreferencesDocument> | undefined
>(undefined);

/**
 * To all descendents, expose the parsed user preferences (with defaults) and the the raw RxDocument for update ability
 * @param props
 * @returns
 */
export function UserPreferencesProvider(props: UserPreferencesProviderProps) {
  const db = useRxDb(),
    user = useUser(),
    [upContext, setUpContext] = useState<UserPreferencesDocument | undefined>(
      undefined
    ),
    [rupContext, setRupContext] = useState<
      RxDocument<UserPreferencesDocument> | undefined
    >(),
    hasRun = useRef(false);

  useEffect(() => {
    let sub: Subscription | undefined;

    if (!hasRun.current) {
      hasRun.current = true;
      createUserPreferencesIfNone(db, user.id).then(() => {
        sub = fetchUserPreferences(db, user.id, (item) => {
          setUpContext(item?.userPreferences);
          setRupContext(item?.rawUserPreferences);
        });
      });
    }
    return () => {
      sub?.unsubscribe();
    };
  }, [db, user.id]);

  return (
    <UserPreferencesContext.Provider value={upContext}>
      <RawUserPreferencesContext.Provider value={rupContext}>
        {props.children}
      </RawUserPreferencesContext.Provider>
    </UserPreferencesContext.Provider>
  );
}

/**
 * A react hook to get the parsed user preferences (with defaults). Not modifiable
 * @returns The parsed user preferences (with defaults)
 */
export function useUserPreferences(): UserPreferencesDocument | undefined {
  const context = useContext(UserPreferencesContext);
  return context;
}

/**
 * A react hook to get the raw RxDocument for the user preferences. Use this to update the document
 * @returns The raw RxDocument for the user preferences. Use this to update the document
 */
export function useRawUserPreferences():
  | RxDocument<UserPreferencesDocument>
  | undefined {
  const context = useContext(RawUserPreferencesContext);
  return context;
}
