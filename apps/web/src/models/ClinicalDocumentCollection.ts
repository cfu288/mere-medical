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
      maxLength: 100,
    },
    source_record: {
      type: 'string',
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
          maxLength: 100,

          // enum: [
          //   'immunization',
          //   'procedure',
          //   'condition',
          //   'observation',
          //   'diagnostic_report',
          // ],
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
          maxLength: 100,
        },
        display_name: {
          type: 'string',
        },
        merge_key: {
          type: 'string',
        },
      },
    },
  },
  indexes: ['metadata.date', 'data_record.resource_type'],
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
