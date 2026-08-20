import { RxDatabase, RxDocument } from 'rxdb';
import { ONPATIENT_CONSTANTS } from '@mere/fhir-oauth';
import { AppConfig } from '../../../app/providers/AppConfigProvider';
import { DatabaseCollections } from '../../../app/providers/DatabaseCollections';
import { AnyConnectionDocument } from '../../../models/connection-document/ConnectionDocument.type';
import { parseEpicFhirBaseUrl } from '../EpicUtils';
import { FhirBaseUrl, SyncContext } from './SyncContext';

export type SyncContextResult =
  | { ok: true; ctx: SyncContext }
  | { ok: false; reason: string };

function fhirBaseUrlOf(document: AnyConnectionDocument): FhirBaseUrl {
  switch (document.source) {
    case 'epic':
      return parseEpicFhirBaseUrl(document.location) as FhirBaseUrl;
    case 'onpatient':
      return ONPATIENT_CONSTANTS.FHIR_URL as FhirBaseUrl;
    default:
      return String(document.location) as FhirBaseUrl;
  }
}

/**
 * Builds the context a vendor needs to sync a connection.
 *
 * The FHIR base URL is resolved once here, so a connection whose URL cannot be
 * determined never reaches vendor code.
 */
export function resolveSyncContext(input: {
  config: AppConfig;
  db: RxDatabase<DatabaseCollections>;
  connection: RxDocument<AnyConnectionDocument>;
  useProxy: boolean;
}): SyncContextResult {
  const document = input.connection.toMutableJSON();

  try {
    return {
      ok: true,
      ctx: {
        config: input.config,
        db: input.db,
        connection: input.connection,
        document,
        fhirBaseUrl: fhirBaseUrlOf(document),
        useProxy: input.useProxy,
      },
    };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : 'Unknown' };
  }
}

/**
 * Re-reads a connection after a token refresh has written to it.
 *
 * The refreshed credentials must be the ones the sync uses.
 */
export function contextAfterRefresh(ctx: SyncContext): SyncContext {
  const document = ctx.connection.toMutableJSON();
  return { ...ctx, document, fhirBaseUrl: fhirBaseUrlOf(document) };
}
