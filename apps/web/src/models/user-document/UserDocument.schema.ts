export const userDocumentSchemaLiteral = {
  title: 'User Document Schema',
  version: 1,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: {
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
    is_default_user: {
      type: 'boolean',
      default: false,
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
  attachments: {
    encrypted: false, // if true, the attachment-data will be encrypted with the db-password
  },
} as const;
