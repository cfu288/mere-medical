import { RxCollection } from 'rxdb';
import {
  toTypedRxJsonSchema,
  ExtractDocumentTypeFromTypedRxJsonSchema,
  RxJsonSchema,
} from 'rxdb';
import { userPreferencesSchemaLiteral } from './UserPreferences.schema';

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
