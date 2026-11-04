import { render, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { RxDatabase } from 'rxdb';

import { DatabaseCollections } from '../../../app/providers/DatabaseCollections';
import { UserProvider } from '../../../app/providers/UserProvider';
import {
  cleanupTestDatabase,
  createTestDatabase,
} from '../../../test-utils/createTestDatabase';
import { TestProviders } from '../../../test-utils/TestProviders';
import OnPatientRedirect from './OnPatientRedirect';

describe('OnPatientRedirect', () => {
  let db: RxDatabase<DatabaseCollections>;

  beforeEach(async () => {
    jest.spyOn(Date, 'now').mockReturnValue(1700000000000);
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        access_token: 'new-access-token',
        refresh_token: 'new-refresh-token',
        expires_in: 3600,
        scope: 'patient/*.read',
      }),
    }) as unknown as typeof fetch;
    db = await createTestDatabase();
    await db.user_documents.insert({
      id: 'user-1',
      is_selected_user: true,
      is_default_user: true,
    });
    await db.connection_documents.insert({
      id: 'conn-1',
      user_id: 'user-1',
      source: 'onpatient',
      name: 'OnPatient',
      location: 'https://onpatient.com',
      access_token: 'old-access-token',
      refresh_token: 'old-refresh-token',
      expires_at: 1600000000,
      scope: 'patient/*.read',
      last_sync_was_error: true,
    });
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    await cleanupTestDatabase(db);
  });

  it('saves the new tokens to the existing OnPatient connection', async () => {
    render(
      <MemoryRouter initialEntries={['/onpatient/callback?session=session-1']}>
        <TestProviders db={db}>
          <UserProvider>
            <OnPatientRedirect />
          </UserProvider>
        </TestProviders>
      </MemoryRouter>,
    );

    await waitFor(async () => {
      const connection = await db.connection_documents.findOne('conn-1').exec();
      expect(connection?.toJSON()).toEqual({
        id: 'conn-1',
        user_id: 'user-1',
        source: 'onpatient',
        name: 'OnPatient',
        location: 'https://onpatient.com',
        access_token: 'new-access-token',
        refresh_token: 'new-refresh-token',
        expires_at: 1700003600,
        scope: 'patient/*.read',
        last_sync_was_error: false,
      });
    });
  });
});
