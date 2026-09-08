import type { StatementSync } from 'node:sqlite';

type SqlParams = Record<string, unknown> | unknown[];

/**
 * Reads query results as a hand-written row type.
 *
 * `node:sqlite` types every column as a union, so the mapping from a SELECT to a row
 * interface is unchecked; `schema-drift.spec.ts` is what keeps these honest.
 */
export function allRows<T>(
  statement: StatementSync,
  params: SqlParams = [],
): T[] {
  const result = Array.isArray(params)
    ? statement.all(...(params as never[]))
    : statement.all(params as never);
  return result as unknown as T[];
}

export function getRow<T>(
  statement: StatementSync,
  params: SqlParams = [],
): T | null {
  const result = Array.isArray(params)
    ? statement.get(...(params as never[]))
    : statement.get(params as never);
  return (result as unknown as T | undefined) ?? null;
}
