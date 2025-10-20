export const vectorStorageSchemaLiteral = {
  title: 'Vector Storage Schema',
  description: "A document that stores an embedding of a document's text.",
  version: 5,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: {
      type: 'string',
      maxLength: 128,
    },
    user_id: {
      type: 'string',
      maxLength: 128,
      ref: 'user_documents',
      description: 'The user that this vector document belongs to',
    },
    hash: {
      type: 'string',
      maxLength: 128,
    },
    metadata: {
      type: 'object',
      properties: {
        documentId: {
          type: 'string',
          maxLength: 256,
        },
        sectionName: {
          type: 'string',
          maxLength: 100,
        },
        chunkNumber: {
          type: 'number',
        },
        isFullDocument: {
          type: 'boolean',
        },
      },
    },
    timestamp: {
      type: 'number',
      multipleOf: 1,
    },
    vectorMag: {
      type: 'number',
      optional: true,
    },
    vector: {
      type: 'array',
      items: {
        type: 'number',
      },
      optional: true,
    },
  },
  indexes: ['metadata.documentId', 'user_id'],
} as const;
