import { RxDatabase, RxDocument } from 'rxdb';
import { AppConfig } from '../../app/providers/AppConfigProvider';
import { DatabaseCollections } from '../../app/providers/DatabaseCollections';
import { AnyConnectionDocument } from '../../models/connection-document/ConnectionDocument.type';
import {
  cleanupTestDatabase,
  createTestDatabase,
} from '../../test-utils/createTestDatabase';
import { refreshVAConnectionTokenIfNeeded } from './VA';

describe('refreshVAConnectionTokenIfNeeded', () => {
  let db: RxDatabase<DatabaseCollections>;

  beforeEach(async () => {
    jest.spyOn(Date, 'now').mockReturnValue(1700000000000);
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        access_token: 'new-access-token',
        expires_in: 3600,
        scope: 'launch/patient patient/Observation.read',
      }),
    }) as unknown as typeof fetch;
    db = await createTestDatabase();
    await db.connection_documents.insert({
      id: 'conn-1',
      user_id: 'user-1',
      source: 'va',
      name: 'VA',
      location: 'https://sandbox-api.va.gov/services/fhir/v0/r4/',
      access_token: 'old-access-token',
      refresh_token: 'refresh-token',
      id_token: 'id-token',
      expires_at: 1600000000,
      scope: 'launch/patient patient/Observation.read',
      patient: 'patient-1',
      auth_uri: 'https://sandbox-api.va.gov/oauth2/authorization',
      token_uri: 'https://sandbox-api.va.gov/oauth2/token',
      last_sync_was_error: true,
    });
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    await cleanupTestDatabase(db);
  });

  it('saves a new access token when the stored one has expired', async () => {
    const connection = (await db.connection_documents
      .findOne('conn-1')
      .exec()) as RxDocument<AnyConnectionDocument>;

    await refreshVAConnectionTokenIfNeeded(
      {
        VA_CLIENT_ID: 'va-client',
        PUBLIC_URL: 'https://app.example.org',
      } as AppConfig,
      connection,
      db,
    );

    const saved = await db.connection_documents.findOne('conn-1').exec();
    expect(saved?.toJSON()).toEqual({
      id: 'conn-1',
      user_id: 'user-1',
      source: 'va',
      name: 'VA',
      location: 'https://sandbox-api.va.gov/services/fhir/v0/r4/',
      access_token: 'new-access-token',
      refresh_token: 'refresh-token',
      id_token: 'id-token',
      expires_at: 1700003600,
      scope: 'launch/patient patient/Observation.read',
      patient: 'patient-1',
      auth_uri: 'https://sandbox-api.va.gov/oauth2/authorization',
      token_uri: 'https://sandbox-api.va.gov/oauth2/token',
      last_sync_was_error: false,
    });
  });
});
