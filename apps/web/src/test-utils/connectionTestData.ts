import {
  ConnectionDocument,
  EpicConnectionDocument,
  CernerConnectionDocument,
  VAConnectionDocument,
  VeradigmConnectionDocument,
} from '../models/connection-document/ConnectionDocument.type';
import uuid4 from '../shared/utils/UUIDUtils';

export function createTestConnection(
  overrides?: Partial<ConnectionDocument>,
): ConnectionDocument {
  return {
    id: uuid4(),
    user_id: 'test-user-id',
    source: 'onpatient',
    name: 'Test Hospital',
    location: 'https://test-hospital.com/fhir',
    access_token: 'test-access-token',
    expires_at: Date.now() + 3600000,
    scope: 'patient/*.read',
    ...overrides,
  };
}

export function createEpicConnection(
  overrides?: Partial<EpicConnectionDocument>,
): EpicConnectionDocument {
  return {
    id: uuid4(),
    user_id: 'test-user-id',
    source: 'epic',
    name: 'Epic Test Hospital',
    location: 'https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4',
    access_token: 'epic-access-token',
    expires_at: Date.now() + 3600000,
    scope: 'patient/*.read',
    client_id: 'test-client-id',
    patient: 'test-patient-id',
    auth_uri: 'https://fhir.epic.com/interconnect-fhir-oauth/oauth2/authorize',
    token_uri: 'https://fhir.epic.com/interconnect-fhir-oauth/oauth2/token',
    ...overrides,
  };
}

export function createCernerConnection(
  overrides?: Partial<CernerConnectionDocument>,
): CernerConnectionDocument {
  return {
    id: uuid4(),
    user_id: 'test-user-id',
    source: 'cerner',
    name: 'Cerner Test Hospital',
    location: 'https://fhir-myrecord.cerner.com/r4',
    access_token: 'cerner-access-token',
    expires_at: Date.now() + 3600000,
    scope: 'patient/*.read',
    id_token: 'cerner-id-token',
    auth_uri:
      'https://authorization.cerner.com/tenants/test/protocols/oauth2/profiles/smart-v1/authorize',
    token_uri:
      'https://authorization.cerner.com/tenants/test/protocols/oauth2/profiles/smart-v1/token',
    refresh_token: 'cerner-refresh-token',
    ...overrides,
  };
}

export function createVAConnection(
  overrides?: Partial<VAConnectionDocument>,
): VAConnectionDocument {
  return {
    id: uuid4(),
    user_id: 'test-user-id',
    source: 'va',
    name: 'VA Health',
    location: 'https://sandbox-api.va.gov/services/fhir/v0/r4',
    access_token: 'va-access-token',
    expires_at: Date.now() + 3600000,
    scope: 'patient/*.read',
    id_token: 'va-id-token',
    auth_uri: 'https://sandbox-api.va.gov/oauth2/authorization',
    token_uri: 'https://sandbox-api.va.gov/oauth2/token',
    patient: 'va-patient-id',
    refresh_token: 'va-refresh-token',
    ...overrides,
  };
}

export function createVeradigmConnection(
  overrides?: Partial<VeradigmConnectionDocument>,
): VeradigmConnectionDocument {
  return {
    id: uuid4(),
    user_id: 'test-user-id',
    source: 'veradigm',
    name: 'Veradigm Test',
    location: 'https://fhir.veradigm.com/dstu2/fhir',
    access_token: 'veradigm-access-token',
    expires_at: Date.now() + 3600000,
    scope: 'patient/*.read',
    id_token: 'veradigm-id-token',
    auth_uri: 'https://oauth.veradigm.com/authorize',
    token_uri: 'https://oauth.veradigm.com/token',
    ...overrides,
  };
}

export function createMultipleTestConnections(
  count: number,
  userId = 'test-user-id',
): ConnectionDocument[] {
  const connections: ConnectionDocument[] = [];

  for (let i = 0; i < count; i++) {
    connections.push(
      createTestConnection({
        user_id: userId,
        name: `Hospital ${i + 1}`,
        location: `https://hospital${i + 1}.com/fhir`,
      }),
    );
  }

  return connections;
}

export function createExpiredConnection(
  overrides?: Partial<ConnectionDocument>,
): ConnectionDocument {
  return createTestConnection({
    expires_at: Date.now() - 3600000,
    ...overrides,
  });
}

export function createConnectionWithTimestamps(
  overrides?: Partial<ConnectionDocument>,
): ConnectionDocument {
  return createTestConnection({
    last_refreshed: new Date().toISOString(),
    last_sync_attempt: new Date().toISOString(),
    last_sync_was_error: false,
    ...overrides,
  });
}
