import { BaseDocument } from './BaseDocument';

export interface UserDocument extends BaseDocument {
  gender?: string;
  birthday?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  is_selected_user?: boolean; // In a multi-user app, who is currently the current user
  is_default_user?: boolean; // Only is true if a user has not been created yet
}
