import { RxCollection, RxDocument } from 'rxdb';

/**
 * Inserts a document, or returns the stored one when a document with its id
 * already exists. Two calls at once with the same id store one document. The
 * preference repositories create a user's preferences with it.
 *
 * @param collection `RxCollection<T>`. A collection whose primary key is `id`.
 * @param document `T & { id: string }`. The document to insert.
 * @returns `Promise<{ doc: RxDocument<T>; inserted: boolean }>`. `inserted` is
 * false when the stored document was already there.
 *
 * @example
 * const { doc, inserted } = await insertOrFindById(db.user_preferences, { id: user.id, user_id: user.id, use_proxy: false });
 */
export async function insertOrFindById<T>(
  collection: RxCollection<T>,
  document: T & { id: string },
): Promise<{ doc: RxDocument<T>; inserted: boolean }> {
  const { success, error } = await collection.bulkInsert([document]);
  if (success.length > 0) {
    return { doc: success[0], inserted: true };
  }
  if (error[0].status !== 409) {
    throw error[0];
  }
  return {
    doc: await collection.findOne(document.id).exec(true),
    inserted: false,
  };
}
