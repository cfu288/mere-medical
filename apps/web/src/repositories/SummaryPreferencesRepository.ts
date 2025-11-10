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

export async function getSummaryPreferences(
  db: RxDatabase<DatabaseCollections>,
  userId: string
): Promise<SummaryPagePreferences | null> {
  const doc = await db.summary_page_preferences
    .findOne({ selector: { user_id: userId } })
    .exec();

  return doc ? (doc.toJSON() as SummaryPagePreferences) : null;
}

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

export async function updateCardPreferences(
  db: RxDatabase<DatabaseCollections>,
  userId: string,
  cards: SummaryPagePreferencesCard[]
): Promise<void> {
  const doc = await db.summary_page_preferences
    .findOne({ selector: { user_id: userId } })
    .exec();

  if (!doc) {
    throw new Error(
      'Summary preferences do not exist. Call ensureSummaryPreferencesExist first.'
    );
  }

  await doc.update({ $set: { cards } });
}

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
