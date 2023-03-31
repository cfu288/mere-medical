import { BaseDocument } from '../BaseDocument';

export type ConnectionSources = 'epic' | 'onpatient' | 'cerner' | 'veradigm';

export interface ConnectionDocument extends BaseDocument {
  user_id: string;
  access_token: string;
  expires_in: number;
  refresh_token: string;
  scope: string;
  source: ConnectionSources;
  name: string;
  location: string;
  last_refreshed: string;
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
  auth_uri: string; // the OAuth authorization url
  token_uri: string; // the OAuth token url
}

export type CreateCernerConnectionDocument = Omit<
  CernerConnectionDocument,
  'last_refreshed'
>;

export interface VeradigmConnectionDocument extends ConnectionDocument {
  id_token: string; // An OAuth ID token
  auth_uri: string; // the OAuth authorization url
  token_uri: string; // the OAuth token url
}

export type CreateVeradigmConnectionDocument = Omit<
  VeradigmConnectionDocument,
  'last_refreshed' | 'refresh_token' | 'scope'
>;

export type CreateEpicConnectionDocument = Omit<
  EpicConnectionDocument,
  'last_refreshed'
>;

export type CreateOnPatientConnectionDocument = Omit<
  ConnectionDocument,
  'last_refreshed'
>;
