import { RxDatabase } from 'rxdb';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { DatabaseCollections } from '../components/providers/DatabaseCollections';
import {
  SummaryPagePreferences,
  SummaryPagePreferencesCard,
} from '../models/summary-page-preferences/SummaryPagePreferences.type';
import uuid4 from '../utils/UUIDUtils';

export const DEFAULT_CARD_ORDER: SummaryPagePreferencesCard[] = [
  {
    type: 'recommendations',
    order: 0,
    is_visible: false,
  },
  {
    type: 'pinned',
    order: 1,
    is_visible: true,
  },
  {
    type: 'medications',
    order: 2,
    is_visible: true,
  },
  {
    type: 'conditions',
    order: 3,
    is_visible: true,
  },
  {
    type: 'immunizations',
    order: 4,
    is_visible: true,
  },
  {
    type: 'careplans',
    order: 5,
    is_visible: true,
  },
  {
    type: 'allergies',
    order: 6,
    is_visible: true,
  },
];

/**
 * Query Functions
 */

/**
 * Fetches the summary page preferences for a specific user.
 * @param db - The RxDB database instance
 * @param userId - The user ID to fetch preferences for
 * @returns The user's summary preferences or null if not found
 */
export async function getSummaryPreferences(
  db: RxDatabase<DatabaseCollections>,
  userId: string
): Promise<SummaryPagePreferences | null> {
  const doc = await db.summary_page_preferences
    .findOne({ selector: { user_id: userId } })
    .exec();

  return doc ? (doc.toJSON() as SummaryPagePreferences) : null;
}

/**
 * Fetches the card preferences for a user with fallback to default card order.
 * Useful when you always need a valid card configuration, even if the user has no saved preferences.
 * @param db - The RxDB database instance
 * @param userId - The user ID to fetch preferences for
 * @returns The user's card preferences or DEFAULT_CARD_ORDER if not found
 */
export async function getCardsWithDefaults(
  db: RxDatabase<DatabaseCollections>,
  userId: string
): Promise<SummaryPagePreferencesCard[]> {
  const preferences = await getSummaryPreferences(db, userId);
  return preferences?.cards || DEFAULT_CARD_ORDER;
}

/**
 * Reactive Functions
 */

/**
 * Creates an Observable that emits the user's summary preferences whenever they change.
 * @param db - The RxDB database instance
 * @param userId - The user ID to watch preferences for
 * @returns An Observable that emits the current preferences or null
 */
export function watchSummaryPreferences(
  db: RxDatabase<DatabaseCollections>,
  userId: string
): Observable<SummaryPagePreferences | null> {
  return db.summary_page_preferences
    .findOne({ selector: { user_id: userId } })
    .$.pipe(
      map((doc) => (doc ? (doc.toJSON() as SummaryPagePreferences) : null))
    );
}

/**
 * Command Functions
 */

/**
 * Ensures that a summary preferences document exists for the user.
 * Creates a new document with default values if none exists.
 * @param db - The RxDB database instance
 * @param userId - The user ID to ensure preferences for
 * @returns True if a new document was created, false if one already existed
 */
export async function ensureSummaryPreferencesExist(
  db: RxDatabase<DatabaseCollections>,
  userId: string
): Promise<boolean> {
  const existing = await db.summary_page_preferences
    .findOne({ selector: { user_id: userId } })
    .exec();

  if (existing) {
    return false;
  }

  await db.summary_page_preferences.insert({
    id: uuid4(),
    user_id: userId,
    pinned_labs: [],
  });

  return true;
}

/**
 * Updates summary preferences for a user, creating a new document if none exists.
 * Use this for partial updates to any preference fields.
 * @param db - The RxDB database instance
 * @param userId - The user ID to update preferences for
 * @param preferences - Partial preferences object to merge with existing preferences
 */
export async function updateSummaryPreferences(
  db: RxDatabase<DatabaseCollections>,
  userId: string,
  preferences: Partial<Omit<SummaryPagePreferences, 'id' | 'user_id'>>
): Promise<void> {
  const doc = await db.summary_page_preferences
    .findOne({ selector: { user_id: userId } })
    .exec();

  if (doc) {
    await doc.update({ $set: preferences });
  } else {
    await db.summary_page_preferences.insert({
      id: uuid4(),
      user_id: userId,
      pinned_labs: [],
      ...preferences,
    });
  }
}

/**
 * Sets the complete list of pinned labs for a user, creating a document if needed.
 * Use this when you have the complete list of pinned labs to save.
 * @param db - The RxDB database instance
 * @param userId - The user ID to update preferences for
 * @param pinnedLabs - Complete array of pinned lab IDs to replace existing ones
 */
export async function upsertPinnedLabs(
  db: RxDatabase<DatabaseCollections>,
  userId: string,
  pinnedLabs: string[]
): Promise<void> {
  const doc = await db.summary_page_preferences
    .findOne({ selector: { user_id: userId } })
    .exec();

  if (doc) {
    await doc.update({ $set: { pinned_labs: pinnedLabs } });
  } else {
    await db.summary_page_preferences.insert({
      id: uuid4(),
      user_id: userId,
      pinned_labs: pinnedLabs,
    });
  }
}

/**
 * Toggles a lab's pinned status for a user.
 * Adds the lab if not pinned, removes it if already pinned.
 * Creates a preferences document if none exists.
 * @param db - The RxDB database instance
 * @param userId - The user ID to toggle pin for
 * @param labId - The lab ID to toggle
 * @returns The new pinned status (true if now pinned, false if unpinned)
 */
export async function togglePinnedLab(
  db: RxDatabase<DatabaseCollections>,
  userId: string,
  labId: string
): Promise<boolean> {
  const doc = await db.summary_page_preferences
    .findOne({ selector: { user_id: userId } })
    .exec();

  const currentPinnedLabs = doc
    ? ((doc.toJSON() as SummaryPagePreferences).pinned_labs || [])
    : [];
  const pinnedSet = new Set(currentPinnedLabs);

  const isPinned = pinnedSet.has(labId);
  const updatedList = isPinned
    ? currentPinnedLabs.filter((id) => id !== labId)
    : [...currentPinnedLabs, labId];

  if (doc) {
    await doc.update({ $set: { pinned_labs: updatedList } });
  } else {
    await db.summary_page_preferences.insert({
      id: uuid4(),
      user_id: userId,
      pinned_labs: updatedList,
    });
  }

  return !isPinned;
}

/**
 * Updates the card preferences (order and visibility) for a user.
 * Creates a new preferences document if none exists.
 * Use this when updating card preferences from user interactions.
 * Note: This is functionally identical to upsertCardPreferences.
 * @param db - The RxDB database instance
 * @param userId - The user ID to update preferences for
 * @param cards - Complete array of card preferences to replace existing ones
 */
export async function updateCardPreferences(
  db: RxDatabase<DatabaseCollections>,
  userId: string,
  cards: SummaryPagePreferencesCard[]
): Promise<void> {
  const doc = await db.summary_page_preferences
    .findOne({ selector: { user_id: userId } })
    .exec();

  if (doc) {
    await doc.update({ $set: { cards } });
  } else {
    await db.summary_page_preferences.insert({
      id: uuid4(),
      user_id: userId,
      pinned_labs: [],
      cards,
    });
  }
}

/**
 * Sets the card preferences (order and visibility) for a user.
 * Creates a new preferences document if none exists.
 * Use this when you need to ensure card preferences are saved.
 * Note: This is functionally identical to updateCardPreferences.
 * @param db - The RxDB database instance
 * @param userId - The user ID to update preferences for
 * @param cards - Complete array of card preferences to replace existing ones
 */
export async function upsertCardPreferences(
  db: RxDatabase<DatabaseCollections>,
  userId: string,
  cards: SummaryPagePreferencesCard[]
): Promise<void> {
  const doc = await db.summary_page_preferences
    .findOne({ selector: { user_id: userId } })
    .exec();

  if (doc) {
    await doc.update({ $set: { cards } });
  } else {
    await db.summary_page_preferences.insert({
      id: uuid4(),
      user_id: userId,
      pinned_labs: [],
      cards,
    });
  }
}
