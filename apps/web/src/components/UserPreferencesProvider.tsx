import React, {
  PropsWithChildren,
  useContext,
  useEffect,
  useState,
} from 'react';
import { RxDocument } from 'rxdb';
import { UserPreferencesDocument } from '../models/UserPreferences';
import { useRxDb } from './RxDbProvider';
import { useUser } from './UserProvider';

const defaultPreferences: Partial<UserPreferencesDocument> = {
  use_proxy: false,
  user_id: 'default',
};

/**
 * Take the whole RxDocument and return a parsed version with defaults
 * @param item
 * @returns
 */
export function getUserPreferencesFromRxDocument(
  item: RxDocument<UserPreferencesDocument> | undefined
) {
  return {
    ...defaultPreferences,
    ...item?.toMutableJSON(),
  } as UserPreferencesDocument;
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
 * Expose the parsed user preferences (with defaults) and the the raw RxDocument for update ability
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
    if (user) {
      const sub = db.user_preferences
        .findOne({
          selector: {
            user_id: user._id,
          },
        })
        .$.subscribe((item) => {
          setUpContext({
            userPreferences: getUserPreferencesFromRxDocument(
              item as unknown as RxDocument<UserPreferencesDocument>
            ),
            rawUserPreferences:
              item as unknown as RxDocument<UserPreferencesDocument>,
          });
        });
      return () => {
        sub.unsubscribe();
      };
    }
    return () => undefined;
  }, [db, user]);

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
