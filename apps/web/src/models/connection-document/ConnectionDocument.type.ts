import { BaseDocument } from '../BaseDocument';
import { TDateISO } from '../clinical-document/Date';

export type ConnectionSources = 'epic' | 'onpatient' | 'cerner' | 'veradigm';

export interface ConnectionDocument extends BaseDocument {
  user_id: string;
  access_token: string;
  expires_at: number;
  refresh_token?: string;
  scope?: string;
  source: ConnectionSources;
  name: string;
  location: string | Location;
  last_refreshed?: string | TDateISO;
  last_sync_attempt?: string | TDateISO;
  last_sync_was_error?: boolean;
}

export interface EpicConnectionDocument extends ConnectionDocument {
  client_id: string;
  tenant_id?: string; // A client id specifically provided on dynamic registration
  patient: string; // A patient identifier
  // For now, we don't need a specific auth_uri and token_uri since most Epic instances follow the same pattern
  // of how they define their token and auth OAuth endpoints relative to their base url
  // In the future, we should add them to be technically more correct according to the Smart on FHIR spec
}

export interface CernerConnectionDocument extends ConnectionDocument {
  id_token: string; // An OAuth ID token
  auth_uri: string | Location; // the OAuth authorization url
  token_uri: string | Location; // the OAuth token url
}

export type CreateCernerConnectionDocument = Omit<
  CernerConnectionDocument,
  'last_refreshed' | 'last_sync_attempt' | 'last_sync_was_error'
>;

export interface VeradigmConnectionDocument extends ConnectionDocument {
  id_token: string; // An OAuth ID token
  auth_uri: string | Location; // the OAuth authorization url
  token_uri: string | Location; // the OAuth token url
}

export type CreateVeradigmConnectionDocument = Omit<
  VeradigmConnectionDocument,
  | 'last_refreshed'
  | 'refresh_token'
  | 'scope'
  | 'last_sync_attempt'
  | 'last_sync_was_error'
>;

export type CreateEpicConnectionDocument = Omit<
  EpicConnectionDocument,
  'last_refreshed' | 'last_sync_attempt' | 'last_sync_was_error'
>;

export type CreateOnPatientConnectionDocument = Omit<
  ConnectionDocument,
  'last_refreshed' | 'last_sync_attempt' | 'last_sync_was_error'
>;
