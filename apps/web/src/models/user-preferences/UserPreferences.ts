import { BaseDocument } from '../BaseDocument';

export interface UserPreferencesDocument extends BaseDocument {
  use_proxy: boolean;
  user_id: string;
}
