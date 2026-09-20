/**
 * Owns the `publications` table, which records when `tenants.db` was written and
 * with how many rows. Publish records each write and status lists the recent ones
 * to show row-count deltas.
 */
import type { Selectable } from 'kysely';
import type { Warehouse } from '../open';
import type { PublicationsTable } from '../warehouse-schema';

type Publication = Pick<
  Selectable<PublicationsTable>,
  'published_at' | 'row_count'
>;

/** Saves one publish's date and row count for the status history. */
export async function record(
  db: Warehouse,
  publishedAt: string,
  rowCount: number,
): Promise<void> {
  await db
    .insertInto('publications')
    .values({ published_at: publishedAt, row_count: rowCount })
    .execute();
}

/** The newest publishes first, at most `limit` rows. */
export async function listRecent(
  db: Warehouse,
  limit: number,
): Promise<Publication[]> {
  return db
    .selectFrom('publications')
    .select(['published_at', 'row_count'])
    .orderBy('published_at', 'desc')
    .orderBy('id', 'desc')
    .limit(limit)
    .execute();
}
