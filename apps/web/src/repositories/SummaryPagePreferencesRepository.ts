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
 * Pins a record to the user's summary page, or unpins it when it is already
 * pinned. It reads the saved list, so a pin never drops the other pins. It
 * creates the user's settings when there are none. The pin button on a lab
 * result calls it.
 *
 * @param db `RxDatabase<DatabaseCollections>`.
 * @param userId `string`.
 * @param recordId `string`. The stored id of the record.
 * @returns `Promise<void>`.
 *
 * @example
 * await togglePinnedLab(db, user.id, result.id);
 */
export async function togglePinnedLab(
  db: RxDatabase<DatabaseCollections>,
  userId: string,
  recordId: string,
): Promise<void> {
  const doc = await db.summary_page_preferences
    .findOne({ selector: { user_id: userId } })
    .exec();
  if (!doc) {
    await db.summary_page_preferences.insert({
      id: uuid4(),
      user_id: userId,
      pinned_labs: [recordId],
    });
    return;
  }
  const pinned = doc.pinned_labs || [];
  const updated = pinned.includes(recordId)
    ? pinned.filter((id) => id !== recordId)
    : [...pinned, recordId];
  await doc.update({ $set: { pinned_labs: updated } });
}
