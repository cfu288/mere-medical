import { RxDatabase } from 'rxdb';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { DatabaseCollections } from '../app/providers/DatabaseCollections';
import { UserPreferencesDocument } from '../models/user-preferences/UserPreferences.type';
import uuid4 from '../shared/utils/UUIDUtils';

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
  const doc = await db.user_preferences
    .findOne({ selector: { user_id: userId } })
    .exec();
  if (doc) {
    return false;
  }
  await db.user_preferences.insert({
    id: uuid4(),
    user_id: userId,
    use_proxy: false,
  });
  return true;
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
 * @param updates `Partial<UserPreferencesDocument>`. The fields to change.
 * @returns `Promise<void>`.
 *
 * @example
 * await updateUserPreferences(db, user.id, { use_proxy: true });
 */
export async function updateUserPreferences(
  db: RxDatabase<DatabaseCollections>,
  userId: string,
  updates: Partial<UserPreferencesDocument>,
): Promise<void> {
  const doc = await db.user_preferences
    .findOne({ selector: { user_id: userId } })
    .exec();
  if (doc) {
    await doc.update({ $set: updates });
  } else {
    await db.user_preferences.insert({
      id: uuid4(),
      user_id: userId,
      use_proxy: false,
      ...updates,
    });
  }
}
