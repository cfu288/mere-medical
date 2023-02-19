export const connectionSchemaLiteral = {
  title: 'Connection Document Schema',
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
      type: 'string',
    },
    last_refreshed: {
      type: 'string',
      maxLength: 128,
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
