import { DatabaseSync, SQLInputValue } from 'node:sqlite';
import { SqliteDialect } from 'kysely';

/** Wraps a node:sqlite database in the small interface Kysely's SqliteDialect drives. */
export function nodeSqliteDialect(db: DatabaseSync): SqliteDialect {
  return new SqliteDialect({
    database: {
      close: () => db.close(),
      prepare(sql: string) {
        const statement = db.prepare(sql);
        return {
          reader: statement.columns().length > 0,
          all: (parameters: ReadonlyArray<unknown>) =>
            statement.all(...(parameters as SQLInputValue[])),
          run: (parameters: ReadonlyArray<unknown>) =>
            statement.run(...(parameters as SQLInputValue[])),
          iterate: (parameters: ReadonlyArray<unknown>) =>
            statement.iterate(...(parameters as SQLInputValue[])),
        };
      },
    },
  });
}
