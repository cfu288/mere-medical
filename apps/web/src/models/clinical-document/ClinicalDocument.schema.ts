export const clinicalDocumentSchemaLiteral = {
  title: 'Clinical Document Schema',
  name: 'clinical_documents',
  description:
    "Represents a document that contains a specific health resource (e.g. a FHIR resource or a C-CDA document) for a patient/user as well as metadata about the resource's content",
  version: 4,
  primaryKey: {
    key: 'id',
    fields: ['connection_record_id', 'user_id', 'metadata.id'] as string[],
    separator: '|',
  },
  type: 'object',
  properties: {
    id: {
      type: 'string',
      maxLength: 128,
      description:
        "The document's unique identifier, generated from connection_record_id, user_id, and metadata.id",
    },
    connection_record_id: {
      type: 'string',
      format: 'uuid',
      maxLength: 128,
      ref: 'connection_documents',
      description: 'The connection record that this document belongs to',
    },
    user_id: {
      type: 'string',
      format: 'uuid',
      maxLength: 128,
      ref: 'user_documents',
      description: 'The user that this document belongs to',
    },
    data_record: {
      type: 'object',
      description:
        "Represents a document data, such as a FHIR resource or a C-CDA document, as well as metadata about the document's content",
      properties: {
        raw: {},
        format: {
          type: 'string',
          description:
            'The format of the document data. If FHIR DSTU2, this will be "FHIR.DSTU2"',
        },
        content_type: {
          type: 'string',
          description:
            'Indicates the media type of the resource (e.g. application/fhir+xml, application/fhir+json, application/xml, application/json, etc.)',
        },
        resource_type: {
          type: 'string',
          maxLength: 128,
          description:
            'The type of the resource (e.g. "patient", "observation", "diagnosticreport", etc.) if FHIR. Note that this is lowercased.',
        },
        version_history: {
          type: 'array',
          items: {
            type: 'any',
          },
          description: 'An array of previous versions of the resource',
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
          format: 'uri',
          description: 'Unique uri identifier of the resource',
        },
        date: {
          type: 'string',
          format: 'date-time',
          maxLength: 128,
          description:
            'The date of the resource to display as an ISO 8601 date string',
        },
        display_name: {
          type: 'string',
          description: 'The display name of the resource to display',
        },
        loinc_coding: {
          type: 'array',
          items: {
            type: 'string',
          },
          description: 'An array of LOINC codes for the resource',
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
