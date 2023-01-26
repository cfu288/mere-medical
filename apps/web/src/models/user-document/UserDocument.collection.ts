import { RxCollection } from 'rxdb';
import {
  toTypedRxJsonSchema,
  ExtractDocumentTypeFromTypedRxJsonSchema,
  RxJsonSchema,
} from 'rxdb';
import { userDocumentSchemaLiteral } from './UserDocument.schema';
import { UserDocument } from './UserDocument.type';

// const userDocumentSchemaTyped = toTypedRxJsonSchema(userDocumentSchemaLiteral);

// type UserDocumentType = ExtractDocumentTypeFromTypedRxJsonSchema<
//   typeof userDocumentSchemaTyped
// >;

export const UserDocumentSchema: RxJsonSchema<UserDocument> =
  userDocumentSchemaLiteral;

export type UserDocumentCollection = RxCollection<UserDocument>;
