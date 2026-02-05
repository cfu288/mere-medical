import { BaseDocument } from '../BaseDocument';
import { TDateISO } from '../clinical-document/Date';

export type ConnectionSources =
  | 'epic'
  | 'onpatient'
  | 'cerner'
  | 'veradigm'
  | 'va'
  | 'healow'
  | 'athena';

export interface ConnectionDocument extends BaseDocument {
  user_id: string;
  access_token: string;
  expires_at: number;
  refresh_token?: string;
  scope?: string;
  id_token?: string;
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
  auth_uri: string | Location; // the OAuth authorization url
  token_uri: string | Location; // the OAuth token url
  fhir_version?: 'DSTU2' | 'R4';
}

export interface CernerConnectionDocument extends ConnectionDocument {
  id_token: string;
  auth_uri: string | Location;
  token_uri: string | Location;
  fhir_version?: 'DSTU2' | 'R4';
}

export interface VAConnectionDocument extends ConnectionDocument {
  id_token: string; // An OAuth ID token
  auth_uri: string; // the OAuth authorization url
  token_uri: string; // the OAuth token url
  patient: string; // A patient identifier
}

export type CreateVAConnectionDocument = Omit<
  VAConnectionDocument,
  'last_refreshed' | 'last_sync_attempt' | 'last_sync_was_error'
>;

export type CreateCernerConnectionDocument = Omit<
  CernerConnectionDocument,
  'last_refreshed' | 'last_sync_attempt' | 'last_sync_was_error'
>;

export interface VeradigmConnectionDocument extends ConnectionDocument {
  id_token: string;
  auth_uri: string | Location;
  token_uri: string | Location;
  tenant_id?: string;
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

export interface HealowConnectionDocument extends ConnectionDocument {
  id_token: string;
  auth_uri: string | Location;
  token_uri: string | Location;
  tenant_id: string;
}

export type CreateHealowConnectionDocument = Omit<
  HealowConnectionDocument,
  'last_refreshed' | 'last_sync_attempt' | 'last_sync_was_error'
>;

export interface AthenaConnectionDocument extends ConnectionDocument {
  source: 'athena';
  patient: string;
  tenant_id: string;
  environment: 'preview' | 'production';
  auth_uri: string;
  token_uri: string;
  id_token?: string;
}

export type CreateAthenaConnectionDocument = Omit<
  AthenaConnectionDocument,
  'last_refreshed' | 'last_sync_attempt' | 'last_sync_was_error'
>;
