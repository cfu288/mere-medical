export const instanceConfigSchemaLiteral = {
  title: 'Instance Config Schema',
  description: 'Stores server instance configuration fetched from the API',
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: {
      type: 'string',
      maxLength: 64,
    },
    ONPATIENT_CLIENT_ID: {
      type: 'string',
    },
    EPIC_CLIENT_ID: {
      type: 'string',
    },
    EPIC_CLIENT_ID_DSTU2: {
      type: 'string',
    },
    EPIC_CLIENT_ID_R4: {
      type: 'string',
    },
    EPIC_SANDBOX_CLIENT_ID: {
      type: 'string',
    },
    EPIC_SANDBOX_CLIENT_ID_DSTU2: {
      type: 'string',
    },
    EPIC_SANDBOX_CLIENT_ID_R4: {
      type: 'string',
    },
    CERNER_CLIENT_ID: {
      type: 'string',
    },
    VERADIGM_CLIENT_ID: {
      type: 'string',
    },
    VA_CLIENT_ID: {
      type: 'string',
    },
    IS_DEMO: {
      type: 'string',
    },
    PUBLIC_URL: {
      type: 'string',
    },
    REDIRECT_URI: {
      type: 'string',
    },
    updated_at: {
      type: 'number',
    },
  },
  required: ['id'],
} as const;
