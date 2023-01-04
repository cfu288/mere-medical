export const userDocumentSchemaLiteral = {
  title: 'User Document Schema',
  version: 0,
  primaryKey: '_id',
  type: 'object',
  properties: {
    _id: {
      type: 'string',
      maxLength: 128,
    },
    gender: {
      type: 'string',
    },
    birthday: {
      type: 'string',
    },
    first_name: {
      type: 'string',
    },
    last_name: {
      type: 'string',
    },
    email: {
      type: 'string',
    },
    is_selected_user: {
      type: 'boolean',
    },
    user_preferences: {
      ref: 'user_preferences',
      type: 'string',
      maxLength: 128,
    },
  },
} as const;
