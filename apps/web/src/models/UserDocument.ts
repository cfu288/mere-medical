import { BaseDocument } from './BaseDocument';

export interface UserDocument extends BaseDocument {
  gender?: string;
  birthday?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  is_selected_user?: boolean; // In a multi-user app, who is currently the current user
}
