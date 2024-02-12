export const vectorStorageSchemaLiteral = {
  title: 'Vector Storage Schema',
  description: "A document that stores an embedding of a document's text.",
  version: 1,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: {
      type: 'string',
      maxLength: 128,
    },
    metadata: {
      type: 'object',
    },
    timestamp: {
      type: 'number',
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
} as const;
