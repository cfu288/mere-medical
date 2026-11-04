import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { RxDatabase } from 'rxdb';

import { DatabaseCollections } from '../../../app/providers/DatabaseCollections';
import { LocalConfigProvider } from '../../../app/providers/LocalConfigProvider';
import { UserPreferencesProvider } from '../../../app/providers/UserPreferencesProvider';
import { UserProvider } from '../../../app/providers/UserProvider';
import {
  cleanupTestDatabase,
  createTestDatabase,
} from '../../../test-utils/createTestDatabase';
import { TestProviders } from '../../../test-utils/TestProviders';
import { PrivacyAndSecuritySettingsGroup } from './PrivacyAndSecuritySettingsGroup';

describe('PrivacyAndSecuritySettingsGroup', () => {
  let db: RxDatabase<DatabaseCollections>;

  beforeEach(async () => {
    db = await createTestDatabase();
    await db.user_documents.insert({
      id: 'user-1',
      is_selected_user: true,
      is_default_user: true,
    });
    await db.user_preferences.insert({
      id: 'prefs-1',
      user_id: 'user-1',
      use_proxy: false,
    });
  });

  afterEach(async () => {
    await cleanupTestDatabase(db);
  });

  it('turns on the proxy for the user', async () => {
    render(
      <LocalConfigProvider>
        <TestProviders db={db}>
          <UserProvider>
            <UserPreferencesProvider>
              <PrivacyAndSecuritySettingsGroup />
            </UserPreferencesProvider>
          </UserProvider>
        </TestProviders>
      </LocalConfigProvider>,
    );
    fireEvent.click(
      await screen.findByRole('switch', { name: 'Use proxy to sync data' }),
    );

    await waitFor(async () => {
      const preferences = await db.user_preferences.findOne('prefs-1').exec();
      expect(preferences?.toJSON()).toEqual({
        id: 'prefs-1',
        user_id: 'user-1',
        use_proxy: true,
      });
    });
  });
});
