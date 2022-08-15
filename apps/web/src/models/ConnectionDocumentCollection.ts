import { RxCollection } from 'rxdb';
import {
  toTypedRxJsonSchema,
  ExtractDocumentTypeFromTypedRxJsonSchema,
  RxJsonSchema,
} from 'rxdb';

export const connectionSchemaLiteral = {
  title: 'Connection Document Schema',
  version: 0,
  primaryKey: '_id',
  type: 'object',
  properties: {
    _id: {
      type: 'string',
      maxLength: 100,
    },
    type: {
      type: 'string',
    },
    access_token: {
      type: 'string',
    },
    expires_in: {
      type: 'number',
    },
    patient: {
      type: 'string',
    },
    refresh_token: {
      type: 'string',
    },
    scope: {
      type: 'string',
    },
    token_type: {
      type: 'string',
    },
    source: {
      type: 'string',
    },
    location: {
      type: 'string',
    },
    last_refreshed: {
      type: 'string',
    },
  },
} as const;

export const connectionSchemaTyped = toTypedRxJsonSchema(
  connectionSchemaLiteral
);

export type ConnectionDocumentType = ExtractDocumentTypeFromTypedRxJsonSchema<
  typeof connectionSchemaTyped
>;

export const connectionDocumentSchema: RxJsonSchema<ConnectionDocumentType> =
  connectionSchemaLiteral;

export type ConnectionDocumentCollection = RxCollection<ConnectionDocumentType>;
