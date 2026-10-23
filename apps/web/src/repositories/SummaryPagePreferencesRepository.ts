import { RxDatabase } from 'rxdb';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { DatabaseCollections } from '../app/providers/DatabaseCollections';
import { SummaryPagePreferences } from '../models/summary-page-preferences/SummaryPagePreferences.type';
import uuid4 from '../shared/utils/UUIDUtils';

/**
 * Reads the summary page settings of a user, which hold the pinned labs and
 * the card layout. The summary page calls it when it loads.
 *
 * @param db `RxDatabase<DatabaseCollections>`.
 * @param userId `string`.
 * @returns `Promise<SummaryPagePreferences | null>`. Null when the user has
 * never saved any.
 *
 * @example
 * const preferences = await findSummaryPagePreferences(db, user.id);
 */
export async function findSummaryPagePreferences(
  db: RxDatabase<DatabaseCollections>,
  userId: string,
): Promise<SummaryPagePreferences | null> {
  const doc = await db.summary_page_preferences
    .findOne({ selector: { user_id: userId } })
    .exec();
  return doc ? (doc.toMutableJSON() as SummaryPagePreferences) : null;
}

/**
 * Emits the summary page settings of a user now and after every change. The
 * pin button on a lab result uses it to show whether the user pinned the
 * result.
 *
 * @param db `RxDatabase<DatabaseCollections>`.
 * @param userId `string`.
 * @returns `Observable<SummaryPagePreferences | null>`.
 *
 * @example
 * const subscription = watchSummaryPagePreferences(db, user.id).subscribe(setPreferences);
 */
export function watchSummaryPagePreferences(
  db: RxDatabase<DatabaseCollections>,
  userId: string,
): Observable<SummaryPagePreferences | null> {
  return db.summary_page_preferences
    .findOne({ selector: { user_id: userId } })
    .$.pipe(
      map((doc) =>
        doc ? (doc.toMutableJSON() as SummaryPagePreferences) : null,
      ),
    );
}

/**
 * Saves the record ids a user pinned to the summary page, creating the
 * user's settings when there are none. The pin button on a lab result calls
 * it.
 *
 * @param db `RxDatabase<DatabaseCollections>`.
 * @param userId `string`.
 * @param pinnedLabs `string[]`. Stored record ids, replacing the saved list.
 * @returns `Promise<void>`.
 *
 * @example
 * await setPinnedLabs(db, user.id, [...pinned, result.id]);
 */
export async function setPinnedLabs(
  db: RxDatabase<DatabaseCollections>,
  userId: string,
  pinnedLabs: string[],
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
