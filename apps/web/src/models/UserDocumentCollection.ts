import { RxCollection } from 'rxdb';
import {
  toTypedRxJsonSchema,
  ExtractDocumentTypeFromTypedRxJsonSchema,
  RxJsonSchema,
} from 'rxdb';

export const userDocumentSchemaLiteral = {
  title: 'Clinical Document Schema',
  version: 0,
  primaryKey: '_id',
  type: 'object',
  properties: {
    _id: {
      type: 'string',
      maxLength: 100,
    },
    gender: {
      type: 'string',
    },
    birthday: {
      type: 'string',
    },
    first_name: {
      type: 'string',
    },
    last_name: {
      type: 'string',
    },
    email: {
      type: 'string',
    },
  },
} as const;

export const userDocumentSchemaTyped = toTypedRxJsonSchema(
  userDocumentSchemaLiteral
);

type UserDocumentType = ExtractDocumentTypeFromTypedRxJsonSchema<
  typeof userDocumentSchemaLiteral
>;

export const UserDocumentSchema: RxJsonSchema<UserDocumentType> =
  userDocumentSchemaLiteral;

export type UserDocumentCollection = RxCollection<UserDocumentType>;
