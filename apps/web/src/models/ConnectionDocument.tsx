import { BaseDocument } from './BaseDocument';

export interface ConnectionDocument extends BaseDocument {
  access_token: string;
  expires_in: number;
  patient: string;
  refresh_token: string;
  scope: string;
  // token_type: string;
  source: 'epic' | 'onpatient';
  location: string;
  last_refreshed: string;
}

export type CreateConnectionDocument = Omit<
  ConnectionDocument,
  'last_refreshed'
>;
