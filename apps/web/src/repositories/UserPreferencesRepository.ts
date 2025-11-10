import { RxDatabase } from 'rxdb';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { DatabaseCollections } from '../components/providers/DatabaseCollections';
import { UserPreferencesDocument } from '../models/user-preferences/UserPreferences.type';
import uuid4 from '../utils/UUIDUtils';

const DEFAULT_PREFERENCES: Omit<UserPreferencesDocument, 'id' | 'user_id'> = {
  use_proxy: true,
};

/**
 * Query Functions
 */

/**
 * Fetches the user preferences for a specific user.
 * @param db - The RxDB database instance
 * @param userId - The user ID to fetch preferences for
 * @returns The user's preferences or null if not found
 */
export async function getUserPreferences(
  db: RxDatabase<DatabaseCollections>,
  userId: string
): Promise<UserPreferencesDocument | null> {
  const doc = await db.user_preferences
    .findOne({ selector: { user_id: userId } })
    .exec();

  return doc ? doc.toJSON() as UserPreferencesDocument : null;
}

/**
 * Fetches the user preferences with fallback to default values.
 * Useful when you always need a valid preferences object, even if the user has no saved preferences.
 * @param db - The RxDB database instance
 * @param userId - The user ID to fetch preferences for
 * @returns The user's preferences or default preferences if not found
 */
export async function getUserPreferencesWithDefaults(
  db: RxDatabase<DatabaseCollections>,
  userId: string
): Promise<UserPreferencesDocument> {
  const doc = await db.user_preferences
    .findOne({ selector: { user_id: userId } })
    .exec();

  if (doc) {
    return doc.toJSON() as UserPreferencesDocument;
  }

  // Return defaults if no document exists
  return {
    ...DEFAULT_PREFERENCES,
    id: uuid4(),
    user_id: userId,
  };
}

/**
 * Reactive Functions
 */

/**
 * Creates an Observable that emits the user's preferences whenever they change.
 * @param db - The RxDB database instance
 * @param userId - The user ID to watch preferences for
 * @returns An Observable that emits the current preferences or null
 */
export function watchUserPreferences(
  db: RxDatabase<DatabaseCollections>,
  userId: string
): Observable<UserPreferencesDocument | null> {
  return db.user_preferences
    .findOne({ selector: { user_id: userId } })
    .$.pipe(map((doc) => (doc ? doc.toJSON() as UserPreferencesDocument : null)));
}

/**
 * Command Functions
 */

/**
 * Updates user preferences, creating a new document if none exists.
 * Use this for partial updates to any preference fields.
 * @param db - The RxDB database instance
 * @param userId - The user ID to update preferences for
 * @param preferences - Partial preferences object to merge with existing preferences
 */
export async function updateUserPreferences(
  db: RxDatabase<DatabaseCollections>,
  userId: string,
  preferences: Partial<Omit<UserPreferencesDocument, 'id' | 'user_id'>>
): Promise<void> {
  const doc = await db.user_preferences
    .findOne({ selector: { user_id: userId } })
    .exec();

  if (doc) {
    await doc.update({ $set: preferences });
  } else {
    await db.user_preferences.insert({
      ...DEFAULT_PREFERENCES,
      ...preferences,
      id: uuid4(),
      user_id: userId,
    });
  }
}

/**
 * Ensures that a user preferences document exists for the user.
 * Creates a new document with default values if none exists.
 * @param db - The RxDB database instance
 * @param userId - The user ID to ensure preferences for
 * @returns True if a new document was created, false if one already existed
 */
export async function ensureUserPreferencesExist(
  db: RxDatabase<DatabaseCollections>,
  userId: string
): Promise<boolean> {
  const existing = await db.user_preferences
    .findOne({ selector: { user_id: userId } })
    .exec();

  if (existing) {
    return false;
  }

  await db.user_preferences.insert({
    ...DEFAULT_PREFERENCES,
    id: uuid4(),
    user_id: userId,
  });

  return true;
}