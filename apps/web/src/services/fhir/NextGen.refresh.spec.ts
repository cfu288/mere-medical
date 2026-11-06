import { RxDatabase } from 'rxdb';
import { DatabaseCollections } from '../../app/providers/DatabaseCollections';
import {
  cleanupTestDatabase,
  createTestDatabase,
} from '../../test-utils/createTestDatabase';
import { createSelectedTestUser } from '../../test-utils/userTestData';
import { createNextGenConnection } from '../../test-utils/connectionTestData';
import { createConnection } from '../../repositories/ConnectionRepository';
import { refreshNextGenConnectionTokenIfNeeded } from './NextGen';

const config = {
  NEXTGEN_CLIENT_ID: 'id',
  PUBLIC_URL: 'https://mere.example',
};

describe('refreshNextGenConnectionTokenIfNeeded', () => {
  let db: RxDatabase<DatabaseCollections>;
  const fetchMock = jest.fn();
  const originalFetch = global.fetch;

  beforeEach(async () => {
    db = await createTestDatabase();
    await db.user_documents.insert(createSelectedTestUser({ id: 'user-1' }));
    global.fetch = fetchMock;
    fetchMock.mockReset();
  });

  afterEach(async () => {
    localStorage.clear();
    global.fetch = originalFetch;
    await cleanupTestDatabase(db);
  });

  it('passes a registration token refusal through with the server description', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 401,
      text: async () =>
        JSON.stringify({
          error: 'registration_token_rejected',
          error_description:
            'Your invite link does not work for this Mere app. Ask your Mere administrator for a new one.',
        }),
    });
    const connection = await createConnection(
      db,
      createNextGenConnection({ user_id: 'user-1', expires_at: 0 }),
    );

    await expect(
      refreshNextGenConnectionTokenIfNeeded(config, connection, db),
    ).rejects.toMatchObject({
      code: 'registration_token_rejected',
      message:
        'Your invite link does not work for this Mere app. Ask your Mere administrator for a new one.',
    });
  });

  it('keeps the refused key', async () => {
    localStorage.setItem(
      'config',
      JSON.stringify({ registration_token: 'stale-registration-token' }),
    );
    fetchMock.mockResolvedValue({
      ok: false,
      status: 401,
      text: async () =>
        JSON.stringify({
          error: 'registration_token_rejected',
          error_description:
            'Your invite link does not work for this Mere app. Ask your Mere administrator for a new one.',
        }),
    });
    const connection = await createConnection(
      db,
      createNextGenConnection({ user_id: 'user-1', expires_at: 0 }),
    );

    await expect(
      refreshNextGenConnectionTokenIfNeeded(config, connection, db),
    ).rejects.toMatchObject({ code: 'registration_token_rejected' });
    expect(fetchMock.mock.calls[0][1].headers['X-Registration-Token']).toBe(
      'stale-registration-token',
    );
    expect(
      JSON.parse(localStorage.getItem('config') ?? '{}').registration_token,
    ).toBe('stale-registration-token');
  });

  it('still asks for a new login when the vendor refuses the refresh', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 400,
      text: async () => JSON.stringify({ error: 'invalid_grant' }),
    });
    const connection = await createConnection(
      db,
      createNextGenConnection({ user_id: 'user-1', expires_at: 0 }),
    );

    await expect(
      refreshNextGenConnectionTokenIfNeeded(config, connection, db),
    ).rejects.toThrow('Error refreshing token - try logging in again');
  });
});
