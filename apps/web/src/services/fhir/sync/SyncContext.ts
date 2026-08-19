import { RxDatabase, RxDocument } from 'rxdb';
import { AppConfig } from '../../../app/providers/AppConfigProvider';
import { DatabaseCollections } from '../../../app/providers/DatabaseCollections';
import { ConnectionDocument } from '../../../models/connection-document/ConnectionDocument.type';

/**
 * Everything the sync job knows about a connection. Vendors destructure only
 * what they need and narrow `connection` to their own document type.
 */
export type SyncContext = {
  config: AppConfig;
  db: RxDatabase<DatabaseCollections>;
  connection: RxDocument<ConnectionDocument>;
  baseUrl: string;
  useProxy: boolean;
  fetch: typeof globalThis.fetch;
};

/**
 * Token refresh goes through the vendor's OAuth client rather than the sync
 * transport, so `fetch` is not offered here.
 */
export type TokenRefreshContext = Omit<SyncContext, 'fetch'>;

export type VendorSync = {
  refreshToken: ((ctx: TokenRefreshContext) => Promise<unknown>) | null;
  syncAllRecords: (
    ctx: SyncContext,
  ) => Promise<PromiseSettledResult<unknown>[]>;
};
