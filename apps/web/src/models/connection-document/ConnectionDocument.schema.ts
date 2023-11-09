export const connectionSchemaLiteral = {
  title: 'Connection Document Schema',
  version: 3,
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
    type: {
      type: 'string',
    },
    access_token: {
      type: 'string',
    },
    expires_in: {
      type: 'number',
    },
    patient: {
      type: 'string',
    },
    refresh_token: {
      type: 'string',
    },
    name: {
      type: 'string',
    },
    scope: {
      type: 'string',
    },
    token_type: {
      type: 'string',
    },
    source: {
      type: 'string',
    },
    location: {
      description: 'URL of the FHIR server',
      type: 'string',
    },
    last_refreshed: {
      description: 'ISO 8601 date string of last successful sync',
      type: 'string',
      maxLength: 128,
    },
    last_sync_attempt: {
      description: 'ISO 8601 date string of last sync attempt',
      type: 'string',
      maxLength: 128,
    },
    last_sync_was_error: {
      description: 'Boolean indicating if last sync was an error',
      type: 'boolean',
    },
    client_id: {
      type: 'string',
    },
    tenant_id: {
      type: 'string',
    },
    auth_uri: {
      type: 'string',
    },
    token_uri: {
      type: 'string',
    },
    id_token: {
      type: 'string',
    },
  },
  indexes: ['last_refreshed', 'user_id'],
} as const;
