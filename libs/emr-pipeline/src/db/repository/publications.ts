import type { DatabaseSync } from 'node:sqlite';
import { allRows } from '@mere/tenant-db';

export interface Publication {
  published_at: string;
  row_count: number;
}

export function record(
  db: DatabaseSync,
  publishedAt: string,
  rowCount: number,
): void {
  db.prepare(
    `INSERT INTO publications (published_at, row_count) VALUES (?, ?)`,
  ).run(publishedAt, rowCount);
}

export function listRecent(db: DatabaseSync, limit: number): Publication[] {
  return allRows<Publication>(
    db.prepare(
      `SELECT published_at, row_count FROM publications
       ORDER BY published_at DESC, id DESC LIMIT ?`,
    ),
    [limit],
  );
}
