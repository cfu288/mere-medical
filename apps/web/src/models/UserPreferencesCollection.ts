import { RxCollection } from 'rxdb';
import {
  toTypedRxJsonSchema,
  ExtractDocumentTypeFromTypedRxJsonSchema,
  RxJsonSchema,
} from 'rxdb';

export const userPreferencesSchemaLiteral = {
  title: 'User Preferences Schema',
  version: 0,
  primaryKey: '_id',
  type: 'object',
  properties: {
    _id: {
      type: 'string',
      maxLength: 128,
    },
    user_id: {
      ref: 'user_documents',
      type: 'string',
      maxLength: 128,
    },
    use_proxy: {
      type: 'boolean',
    },
  },
  indexes: ['user_id'],
} as const;

export const userPreferencesSchemaTyped = toTypedRxJsonSchema(
  userPreferencesSchemaLiteral
);

type UserPreferencesDocumentType = ExtractDocumentTypeFromTypedRxJsonSchema<
  typeof userPreferencesSchemaTyped
>;

export const UserPreferencesDocumentSchema: RxJsonSchema<UserPreferencesDocumentType> =
  userPreferencesSchemaLiteral;

export type UserPreferencesDocumentCollection =
  RxCollection<UserPreferencesDocumentType>;
