import { RxCollection } from 'rxdb';
import { RxJsonSchema } from 'rxdb';
import { userDocumentSchemaLiteral } from './UserDocument.schema';
import { UserDocument } from './UserDocument.type';

export const UserDocumentSchema: RxJsonSchema<UserDocument> =
  userDocumentSchemaLiteral;

export type UserDocumentCollection = RxCollection<UserDocument>;
