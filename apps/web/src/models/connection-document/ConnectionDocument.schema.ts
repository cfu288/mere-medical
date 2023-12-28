export const connectionSchemaLiteral = {
  title: 'Connection Document Schema',
  name: 'connection_documents',
  description:
    'Metadata used to describe a connection to an external health data provider server, usually FHIR server. Also contains OAuth metadata needed to fetch or refresh access tokens (if possible).',
  version: 4,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: {
      type: 'string',
      format: 'uuid',
      maxLength: 128,
      description: 'A unique identifier for the connection document',
    },
    user_id: {
      type: 'string',
      description: 'The user that this connection belongs to',
      maxLength: 128,
      ref: 'user_documents',
    },
    access_token: {
      type: 'string',
      description: 'OAuth access token',
    },
    expires_at: {
      type: 'number',
      description: 'The UNIX timestamp of when the access token expires',
    },
    patient: {
      type: 'string',
      description: 'A patient identifier, unique to this connection',
    },
    refresh_token: {
      type: 'string',
      description: 'OAuth refresh token',
    },
    name: {
      type: 'string',
      description: 'The name of the connection, dispalyed to the user',
    },
    scope: {
      type: 'string',
      description: 'The OAuth scope(s) of the connection',
    },
    token_type: {
      type: 'string',
      description: 'The OAuth token type of the connection',
    },
    source: {
      type: 'string',
      description:
        'The source of the connection - epic, onpatient, cerner, etc.',
    },
    location: {
      description:
        'URL of the connection/FHIR server where this connection will fetch data from',
      type: 'string',
    },
    last_refreshed: {
      description: 'ISO 8601 date string of last successful sync',
      type: 'string',
      format: 'date-time',
      maxLength: 128,
    },
    last_sync_attempt: {
      description: 'ISO 8601 date string of last sync attempt',
      type: 'string',
      format: 'date-time',
      maxLength: 128,
    },
    last_sync_was_error: {
      description: 'Boolean indicating if last sync was an error',
      type: 'boolean',
    },
    client_id: {
      type: 'string',
      description: 'The OAuth client id',
    },
    tenant_id: {
      type: 'string',
      description:
        'A client id specifically provided on dynamic registration - used in Epic connections',
    },
    auth_uri: {
      type: 'string',
      description: 'The OAuth authorization url',
    },
    token_uri: {
      type: 'string',
      description: 'The OAuth token url',
    },
    id_token: {
      type: 'string',
      description: 'An OAuth ID token',
    },
  },
  indexes: ['last_refreshed', 'user_id'],
} as const;
