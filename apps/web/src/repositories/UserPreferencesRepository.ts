import { RxDatabase } from 'rxdb';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { DatabaseCollections } from '../app/providers/DatabaseCollections';
import { UserPreferencesDocument } from '../models/user-preferences/UserPreferences.type';
import { insertOrFindById } from './insertOrFindById';

/**
 * The preferences a user starts with, before they change any setting.
 *
 * @param userId `string`.
 * @returns `UserPreferencesDocument`. The user id as the id, the user, and
 * proxy sync off.
 *
 * @example
 * const preferences = defaultUserPreferences(user.id); // { id: user.id, user_id: user.id, use_proxy: false }
 */
export function defaultUserPreferences(
  userId: string,
): UserPreferencesDocument {
  return { id: userId, user_id: userId, use_proxy: false };
}

/**
 * Creates default preferences for a user who has none. The preferences
 * provider calls it before it reads the preferences.
 *
 * @param db `RxDatabase<DatabaseCollections>`.
 * @param userId `string`.
 * @returns `Promise<boolean>`. True when it created the preferences.
 *
 * @example
 * await createUserPreferencesIfNone(db, user.id);
 */
export async function createUserPreferencesIfNone(
  db: RxDatabase<DatabaseCollections>,
  userId: string,
): Promise<boolean> {
  const stored = await db.user_preferences
    .findOne({ selector: { user_id: userId } })
    .exec();
  if (stored) {
    return false;
  }
  const { inserted } = await insertOrFindById(
    db.user_preferences,
    defaultUserPreferences(userId),
  );
  return inserted;
}

/**
 * Emits the preferences of a user now and after every change. The preferences
 * provider shares them with the app.
 *
 * @param db `RxDatabase<DatabaseCollections>`.
 * @param userId `string`.
 * @returns `Observable<UserPreferencesDocument | null>`.
 *
 * @example
 * const subscription = watchUserPreferences(db, user.id).subscribe(setPreferences);
 */
export function watchUserPreferences(
  db: RxDatabase<DatabaseCollections>,
  userId: string,
): Observable<UserPreferencesDocument | null> {
  return db.user_preferences
    .findOne({ selector: { user_id: userId } })
    .$.pipe(
      map((doc) =>
        doc ? (doc.toMutableJSON() as UserPreferencesDocument) : null,
      ),
    );
}

/**
 * Changes some preferences of a user, creating the preferences when the user
 * has none. The settings page calls it.
 *
 * @param db `RxDatabase<DatabaseCollections>`.
 * @param userId `string`.
 * @param updates `Omit<Partial<UserPreferencesDocument>, 'id' | 'user_id'>`. The fields to change.
 * @returns `Promise<void>`.
 *
 * @example
 * await updateUserPreferences(db, user.id, { use_proxy: true });
 */
export async function updateUserPreferences(
  db: RxDatabase<DatabaseCollections>,
  userId: string,
  updates: Omit<Partial<UserPreferencesDocument>, 'id' | 'user_id'>,
): Promise<void> {
  const stored = await db.user_preferences
    .findOne({ selector: { user_id: userId } })
    .exec();
  const doc =
    stored ??
    (
      await insertOrFindById(
        db.user_preferences,
        defaultUserPreferences(userId),
      )
    ).doc;
  await doc.atomicPatch(updates);
}
