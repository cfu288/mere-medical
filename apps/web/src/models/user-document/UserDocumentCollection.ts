import { RxCollection } from 'rxdb';
import { ExtractDocumentTypeFromTypedRxJsonSchema, RxJsonSchema } from 'rxdb';
import { userDocumentSchemaLiteral } from './UserDocumentSchema';

type UserDocumentType = ExtractDocumentTypeFromTypedRxJsonSchema<
  typeof userDocumentSchemaLiteral
>;

export const UserDocumentSchema: RxJsonSchema<UserDocumentType> =
  userDocumentSchemaLiteral;

export type UserDocumentCollection = RxCollection<UserDocumentType>;
