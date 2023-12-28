export const userPreferencesSchemaLiteral = {
  title: 'User Preferences Schema',
  description: "Represents a user's preferences and settings",
  version: 2,
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
      description:
        'The id reference to the user document that these preferences belongs to',
    },
    use_proxy: {
      type: 'boolean',
      default: true,
      description:
        'If true, the app will use the self-hosted proxy server to fetch data from the FHIR server instead of reaching out to the FHIR server directly. Used in EPIC connections since many EPIC servers do not allow CORS requests.',
    },
  },
  indexes: ['user_id'],
} as const;
