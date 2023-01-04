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
      maxLength: 128,
    },
    user_id: {
      ref: 'user_documents',
      type: 'string',
      maxLength: 128,
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
    name: {
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
      maxLength: 128,
    },
    client_id: {
      type: 'string',
    },
    tenant_id: {
      type: 'string',
    },
  },
  indexes: ['last_refreshed', 'user_id'],
} as const;

export const connectionSchemaTyped = toTypedRxJsonSchema(
  connectionSchemaLiteral
);

type ConnectionDocumentType = ExtractDocumentTypeFromTypedRxJsonSchema<
  typeof connectionSchemaTyped
>;

export const ConnectionDocumentSchema: RxJsonSchema<ConnectionDocumentType> =
  connectionSchemaLiteral;

export type ConnectionDocumentCollection = RxCollection<ConnectionDocumentType>;
