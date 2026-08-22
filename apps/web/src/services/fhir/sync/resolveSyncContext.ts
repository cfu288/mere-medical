import { RxDatabase, RxDocument } from 'rxdb';
import { ONPATIENT_CONSTANTS } from '@mere/fhir-oauth';
import { AppConfig } from '../../../app/providers/AppConfigProvider';
import { DatabaseCollections } from '../../../app/providers/DatabaseCollections';
import {
  AnyConnectionDocument,
  AthenaConnectionDocument,
  CernerConnectionDocument,
  EpicConnectionDocument,
  HealowConnectionDocument,
  VAConnectionDocument,
  VeradigmConnectionDocument,
} from '../../../models/connection-document/ConnectionDocument.type';
import { parseEpicTenantId, parseEpicFhirBaseUrl } from '../EpicUtils';
import { FhirBaseUrl, SyncContext } from './SyncContext';

export type SyncContextResult =
  | { ok: true; ctx: SyncContext }
  | { ok: false; reason: string };

function parseStoredUrl(location: string | Location): FhirBaseUrl {
  const stored = String(location);
  try {
    new URL(stored);
  } catch {
    throw new Error(`Connection has an unusable address: ${stored}`);
  }
  return stored as FhirBaseUrl;
}

function parseIdTokenPresent(idToken: string | undefined): void {
  if (!idToken) {
    throw new Error(
      'Connection is missing its login token - remove it and add it again',
    );
  }
}

function parseEpicDocument(document: EpicConnectionDocument): FhirBaseUrl {
  parseEpicTenantId(document.tenant_id);
  return parseEpicFhirBaseUrl(document.location) as FhirBaseUrl;
}

function parseCernerDocument(document: CernerConnectionDocument): FhirBaseUrl {
  parseIdTokenPresent(document.id_token);
  return parseStoredUrl(document.location);
}

function parseHealowDocument(document: HealowConnectionDocument): FhirBaseUrl {
  parseIdTokenPresent(document.id_token);
  return parseStoredUrl(document.location);
}

function parseVeradigmDocument(
  document: VeradigmConnectionDocument,
): FhirBaseUrl {
  return parseStoredUrl(document.location);
}

function parseAthenaDocument(document: AthenaConnectionDocument): FhirBaseUrl {
  return parseStoredUrl(document.location);
}

function parseVADocument(document: VAConnectionDocument): FhirBaseUrl {
  return parseStoredUrl(document.location);
}

function parseOnPatientDocument(): FhirBaseUrl {
  return ONPATIENT_CONSTANTS.FHIR_URL as FhirBaseUrl;
}

function parseVendorDocument(document: AnyConnectionDocument): FhirBaseUrl {
  switch (document.source) {
    case 'epic':
      return parseEpicDocument(document);
    case 'cerner':
      return parseCernerDocument(document);
    case 'healow':
      return parseHealowDocument(document);
    case 'veradigm':
      return parseVeradigmDocument(document);
    case 'athena':
      return parseAthenaDocument(document);
    case 'va':
      return parseVADocument(document);
    case 'onpatient':
      return parseOnPatientDocument();
    default:
      return assertNever(document);
  }
}

function assertNever(value: never): never {
  throw new Error(`Cannot sync unknown source: ${JSON.stringify(value)}`);
}

/**
 * Builds the context a vendor needs to sync a connection.
 *
 * Each vendor's parse establishes the fields its sync will read, so a
 * connection that cannot be synced never reaches vendor code.
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
        fhirBaseUrl: parseVendorDocument(document),
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
  return { ...ctx, document, fhirBaseUrl: parseVendorDocument(document) };
}
