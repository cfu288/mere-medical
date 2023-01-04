import { BaseDocument } from '../BaseDocument';

export interface ConnectionDocument extends BaseDocument {
  user_id: string;
  access_token: string;
  expires_in: number;
  patient: string;
  refresh_token: string;
  scope: string;
  // token_type: string;
  source: 'epic' | 'onpatient';
  name: string;
  location: string;
  last_refreshed: string;
  client_id?: string;
  tenant_id?: string;
}

export type CreateConnectionDocument = Omit<
  ConnectionDocument,
  'last_refreshed'
>;
