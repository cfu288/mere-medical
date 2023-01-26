export const userPreferencesSchemaLiteral = {
  title: 'User Preferences Schema',
  version: 1,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: {
      type: 'string',
      maxLength: 128,
    },
    user_id: {
      ref: 'user_documents',
      type: 'string',
      maxLength: 128,
    },
    use_proxy: {
      type: 'boolean',
      default: true,
    },
  },
  indexes: ['user_id'],
} as const;
