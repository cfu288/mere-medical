import { RxCollection } from 'rxdb';
import {
  toTypedRxJsonSchema,
  ExtractDocumentTypeFromTypedRxJsonSchema,
  RxJsonSchema,
} from 'rxdb';

export const clinicalDocumentSchemaLiteral = {
  title: 'Clinical Document Schema',
  version: 0,
  primaryKey: '_id',
  type: 'object',
  properties: {
    _id: {
      type: 'string',
      maxLength: 128,
    },
    connection_record_id: {
      type: 'string',
      maxLength: 128,
      ref: 'connection_documents',
    },
    user_id: {
      type: 'string',
      maxLength: 128,
      ref: 'user_documents',
    },
    data_record: {
      type: 'object',
      properties: {
        raw: {},
        format: {
          type: 'string',
        },
        content_type: {
          type: 'string',
        },
        resource_type: {
          type: 'string',
          maxLength: 128,
        },
        version_history: {
          type: 'array',
          items: {
            type: 'any',
          },
        },
      },
    },
    type: {
      type: 'string',
    },
    metadata: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
        },
        date: {
          type: 'string',
          maxLength: 128,
        },
        display_name: {
          type: 'string',
        },
      },
    },
  },
  indexes: [
    'metadata.date',
    'data_record.resource_type',
    'connection_record_id',
    'user_id',
  ],
} as const;

export const clinicalDocumentSchemaTyped = toTypedRxJsonSchema(
  clinicalDocumentSchemaLiteral
);

export type ClinicalDocumentType = ExtractDocumentTypeFromTypedRxJsonSchema<
  typeof clinicalDocumentSchemaLiteral
>;

export const ClinicalDocumentSchema: RxJsonSchema<ClinicalDocumentType> =
  clinicalDocumentSchemaLiteral;

export type ClinicalDocumentCollection = RxCollection<ClinicalDocumentType>;
