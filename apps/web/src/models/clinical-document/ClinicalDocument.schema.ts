export const clinicalDocumentSchemaLiteral = {
  title: 'Clinical Document Schema',
  version: 2,
  primaryKey: {
    key: 'id',
    fields: ['connection_record_id', 'user_id', 'metadata.id'] as string[],
    // separator which is used to concat the fields values.
    separator: '|',
  },
  type: 'object',
  properties: {
    id: {
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
        loinc_coding: {
          type: 'array',
          items: {
            type: 'string',
          },
        },
      },
    },
  },
  required: ['id'],
  indexes: [
    'metadata.date',
    'data_record.resource_type',
    'connection_record_id',
    'user_id',
  ],
} as const;
