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
    profile_picture: {
      type: 'object',
      properties: {
        content_type: { type: 'string' },
        data: { type: 'string' },
      },
    },
    // attachments: {
    //   type: 'array',
    //   items: {
    //     type: 'object',
    //     properties: {
    //       id: { type: 'string' },
    //       user_id: { type: 'string' },
    //       content_type: { type: 'string' },
    //       data: { type: 'string' },
    //     },
    //   },
    // },
  },
} as const;
