import React, {
  PropsWithChildren,
  useContext,
  useEffect,
  useState,
} from 'react';
import { from } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import uuid4 from '../../shared/utils/UUIDUtils';
import { UserPreferencesDocument } from '../../models/user-preferences/UserPreferences.type';
import {
  createUserPreferencesIfNone,
  watchUserPreferences,
} from '../../repositories/UserPreferencesRepository';
import { useRxDb } from './RxDbProvider';
import { useUser } from './UserProvider';

// Takes a user id and returns a default user preferences document
function createDefaultPreferences(
  user_id: string,
): Partial<UserPreferencesDocument> {
  return { use_proxy: false, user_id, id: uuid4() };
}

/**
 * Take the stored preferences and return a parsed version with defaults
 * @param item
 * @returns
 */
function getUserPreferencesWithDefaults(
  item: UserPreferencesDocument | null,
  user_id: string,
) {
  return {
    ...createDefaultPreferences(user_id),
    ...item,
  } as UserPreferencesDocument;
}

type UserPreferencesProviderProps = PropsWithChildren<unknown>;

const UserPreferencesContext = React.createContext<
  UserPreferencesDocument | undefined
>(undefined);

/**
 * To all descendents, expose the parsed user preferences (with defaults)
 * @param props
 * @returns
 */
export function UserPreferencesProvider(props: UserPreferencesProviderProps) {
  const db = useRxDb(),
    user = useUser(),
    [upContext, setUpContext] = useState<UserPreferencesDocument | undefined>(
      undefined,
    );

  useEffect(() => {
    const sub = from(createUserPreferencesIfNone(db, user.id))
      .pipe(switchMap(() => watchUserPreferences(db, user.id)))
      .subscribe((item) => {
        console.debug('UserPreferencesProvider: ', item);
        setUpContext(getUserPreferencesWithDefaults(item, user.id));
      });
    return () => sub.unsubscribe();
  }, [db, user.id]);

  return (
    <UserPreferencesContext.Provider value={upContext}>
      {props.children}
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
