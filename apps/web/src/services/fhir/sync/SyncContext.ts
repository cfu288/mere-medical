import { RxDatabase, RxDocument } from 'rxdb';
import { AppConfig } from '../../../app/providers/AppConfigProvider';
import { DatabaseCollections } from '../../../app/providers/DatabaseCollections';
import { AnyConnectionDocument } from '../../../models/connection-document/ConnectionDocument.type';

declare const FHIR_BASE_URL: unique symbol;

/**
 * A FHIR base URL established by a vendor's sync-boundary parse.
 *
 * Only {@link resolveSyncContext} produces one, so a raw stored `location`
 * cannot be mistaken for a parsed base URL.
 */
export type FhirBaseUrl = string & { readonly [FHIR_BASE_URL]: true };

export type SyncContext<
  C extends AnyConnectionDocument = AnyConnectionDocument,
> = {
  config: AppConfig;
  db: RxDatabase<DatabaseCollections>;
  connection: RxDocument<AnyConnectionDocument>;
  document: C;
  fhirBaseUrl: FhirBaseUrl;
  useProxy: boolean;
};

export type VendorSync<
  C extends AnyConnectionDocument = AnyConnectionDocument,
> = {
  refreshToken: ((ctx: SyncContext<C>) => Promise<unknown>) | null;
  syncAllRecords: (
    ctx: SyncContext<C>,
  ) => Promise<PromiseSettledResult<unknown>[]>;
};
