import { RxPlugin, RxQuery } from 'rxdb';

type QueryInternals = RxQuery & { _ensureEqualQueue: Promise<boolean> };

/**
 * Lets a query run again after its read failed.
 *
 * RxDB caches queries and chains every run of a query onto its previous run.
 * A run that rejects leaves that chain rejected, so every later `exec()` of
 * the same query rejects with the first error, without reading the database.
 */
export const RxDBRerunFailedQueryPlugin: RxPlugin = {
  name: 'rerun-failed-query',
  rxdb: true,
  prototypes: {
    RxQuery: (proto: RxQuery) => {
      const exec = proto.exec;
      proto.exec = function (this: QueryInternals, ...args: unknown[]) {
        return (exec as (...a: unknown[]) => Promise<unknown>)
          .apply(this, args)
          .catch((error: unknown) => {
            this._ensureEqualQueue = Promise.resolve(false);
            throw error;
          });
      } as RxQuery['exec'];
    },
  },
};
