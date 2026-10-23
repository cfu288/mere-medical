import { RxDatabase } from 'rxdb';
import { DatabaseCollections } from '../../app/providers/DatabaseCollections';
import { UserDocument } from '../../models/user-document/UserDocument.type';
import {
  cleanupTestDatabase,
  createTestDatabase,
} from '../../test-utils/createTestDatabase';
import { saveConnectionToDb } from './Healow';

const user: UserDocument = {
  id: 'user-1',
  is_selected_user: true,
  is_default_user: false,
};

describe('saveConnectionToDb', () => {
  let db: RxDatabase<DatabaseCollections>;

  beforeEach(async () => {
    db = await createTestDatabase();
    await db.user_documents.insert(user);
    await db.connection_documents.insert({
      id: 'conn-1',
      user_id: 'user-1',
      source: 'healow',
      name: 'Healow Clinic',
      location: 'https://fhir.healow.example.org/r4/ABCDEF',
      access_token: 'old-access-token',
      refresh_token: 'old-refresh-token',
      id_token: 'old-id-token',
      expires_at: 1600000000,
      scope: 'patient/*.read',
      auth_uri: 'https://oauth.healow.example.org/authorize',
      token_uri: 'https://oauth.healow.example.org/token',
      tenant_id: 'ABCDEF',
      last_sync_was_error: true,
    });
  });

  afterEach(async () => {
    await cleanupTestDatabase(db);
  });

  it('saves the new tokens to the existing connection on reconnect', async () => {
    await saveConnectionToDb({
      tokens: {
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
        idToken: 'new-id-token',
        expiresAt: 1700003600,
        scope: 'patient/*.read offline_access',
        tenantId: 'ABCDEF',
        raw: {},
      },
      healowBaseUrl: 'https://fhir.healow.example.org/r4/ABCDEF',
      healowName: 'Healow Clinic',
      healowAuthUrl: 'https://oauth.healow.example.org/authorize',
      healowTokenUrl: 'https://oauth.healow.example.org/token',
      healowId: 'ABCDEF',
      db,
      user,
    });

    const connection = await db.connection_documents.findOne('conn-1').exec();
    expect(connection?.toJSON()).toEqual({
      id: 'conn-1',
      user_id: 'user-1',
      source: 'healow',
      name: 'Healow Clinic',
      location: 'https://fhir.healow.example.org/r4/ABCDEF',
      access_token: 'new-access-token',
      refresh_token: 'new-refresh-token',
      id_token: 'new-id-token',
      expires_at: 1700003600,
      scope: 'patient/*.read offline_access',
      auth_uri: 'https://oauth.healow.example.org/authorize',
      token_uri: 'https://oauth.healow.example.org/token',
      tenant_id: 'ABCDEF',
      last_sync_was_error: false,
    });
  });
});
