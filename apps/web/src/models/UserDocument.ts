import { BaseDocument } from './BaseDocument';

export interface UserDocument extends BaseDocument {
  gender?: string;
  birthday?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
}
