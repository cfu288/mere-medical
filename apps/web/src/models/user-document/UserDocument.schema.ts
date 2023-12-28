export const userDocumentSchemaLiteral = {
  title: 'User Document Schema',
  name: 'user_documents',
  version: 2,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: {
      type: 'string',
      maxLength: 128,
      description: 'A unique identifier for the user document',
    },
    gender: {
      type: 'string',
      description: 'The gender of the user',
    },
    birthday: {
      type: 'string',
      description: 'The birthday of the user',
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
      description:
        'This is only set to true if no user has been created yet. It should be false for all users saved to the db.',
    },
    is_selected_user: {
      type: 'boolean',
      description: 'This is true if the user is currently selected.',
    },
    user_preferences: {
      ref: 'user_preferences',
      type: 'string',
      maxLength: 128,
      description: "The id reference to the user's preferences document",
    },
    profile_picture: {
      type: 'object',
      properties: {
        content_type: { type: 'string' },
        data: { type: 'string' },
      },
    },
  },
} as const;
