import React, {
  PropsWithChildren,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { RxDocument } from 'rxdb';
import { Subscription } from 'rxjs';
import { UserPreferencesDocument } from '../../models/user-preferences/UserPreferences.type';
import { useRxDb } from './RxDbProvider';
import { useUser } from './UserProvider';
import * as UserPreferencesRepo from '../../repositories/UserPreferencesRepository';

// Legacy function kept for compatibility - will be removed in future
export function getUserPreferencesFromRxDocument(
  item: RxDocument<UserPreferencesDocument> | undefined,
  user_id: string,
) {
  if (!item) {
    // Return defaults if no document
    return {
      use_proxy: true,
      user_id,
      id: '',
    } as UserPreferencesDocument;
  }
  return item.toMutableJSON() as UserPreferencesDocument;
}

type UserPreferencesProviderProps = PropsWithChildren<unknown>;

const UserPreferencesContext = React.createContext<
  UserPreferencesDocument | undefined
>(undefined);

// Legacy context - kept for backwards compatibility but will be deprecated
// Components should use repository for updates instead of raw RxDocument
const RawUserPreferencesContext = React.createContext<
  RxDocument<UserPreferencesDocument> | undefined
>(undefined);

/**
 * To all descendents, expose the parsed user preferences (with defaults) and the the raw RxDocument for update ability
 * @param props
 * @returns
 */
export function UserPreferencesProvider(props: UserPreferencesProviderProps) {
  const db = useRxDb();
  const user = useUser();
  const [preferences, setPreferences] = useState<UserPreferencesDocument | undefined>(
    undefined,
  );
  // Keep raw document for backwards compatibility - will be removed in future
  const [rawPreferences, setRawPreferences] = useState<
    RxDocument<UserPreferencesDocument> | undefined
  >();
  const hasRun = useRef(false);

  useEffect(() => {
    let sub: Subscription | undefined;

    if (!hasRun.current && db && user) {
      hasRun.current = true;

      // Ensure preferences exist with defaults
      UserPreferencesRepo.ensureUserPreferencesExist(db, user.id).then(() => {
        // Watch for preference changes
        sub = UserPreferencesRepo.watchUserPreferences(db, user.id).subscribe(
          async (prefs) => {
            if (prefs) {
              setPreferences(prefs);
              // For backwards compatibility, also fetch the raw document
              // This will be removed when we deprecate RawUserPreferencesContext
              const rawDoc = await db.user_preferences
                .findOne({ selector: { user_id: user.id } })
                .exec();
              setRawPreferences(rawDoc as RxDocument<UserPreferencesDocument> | undefined);
            } else {
              // If no preferences exist, use defaults
              const defaultPrefs = await UserPreferencesRepo.getUserPreferencesWithDefaults(db, user.id);
              setPreferences(defaultPrefs);
              setRawPreferences(undefined);
            }
          }
        );
      });
    }
    return () => {
      sub?.unsubscribe();
    };
  }, [db, user]);

  return (
    <UserPreferencesContext.Provider value={preferences}>
      <RawUserPreferencesContext.Provider value={rawPreferences}>
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
