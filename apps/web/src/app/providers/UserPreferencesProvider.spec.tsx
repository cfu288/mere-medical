import { act, render, waitFor } from '@testing-library/react';
import { RxDatabase } from 'rxdb';
import { DatabaseCollections } from './DatabaseCollections';
import { UserProvider, useUser } from './UserProvider';
import {
  UserPreferencesProvider,
  useUserPreferences,
} from './UserPreferencesProvider';
import { TestProviders } from '../../test-utils/TestProviders';
import {
  cleanupTestDatabase,
  createTestDatabase,
} from '../../test-utils/createTestDatabase';
import { createTestUser } from '../../test-utils/userTestData';
import { switchUser } from '../../repositories/UserRepository';
import { updateUserPreferences } from '../../repositories/UserPreferencesRepository';

function ProxySetting() {
  const preferences = useUserPreferences();
  return <span data-testid="use-proxy">{String(preferences?.use_proxy)}</span>;
}

const renders: string[] = [];

function RecordedProxySetting() {
  const user = useUser();
  const preferences = useUserPreferences();
  renders.push(`${user.id}: ${String(preferences?.use_proxy)}`);
  return null;
}

describe('UserPreferencesProvider', () => {
  let db: RxDatabase<DatabaseCollections>;

  beforeEach(async () => {
    db = await createTestDatabase();
    await db.user_documents.bulkInsert([
      createTestUser({ id: 'user-a', is_selected_user: true }),
      createTestUser({ id: 'user-b', is_selected_user: false }),
    ]);
    await db.user_preferences.bulkInsert([
      { id: 'prefs-a', user_id: 'user-a', use_proxy: true },
      { id: 'prefs-b', user_id: 'user-b', use_proxy: false },
    ]);
  });

  afterEach(async () => {
    await cleanupTestDatabase(db);
  });

  function renderProvider() {
    return render(
      <TestProviders db={db}>
        <UserProvider>
          <UserPreferencesProvider>
            <ProxySetting />
          </UserPreferencesProvider>
        </UserProvider>
      </TestProviders>,
    );
  }

  it('provides the preferences of the selected user', async () => {
    const { getByTestId } = renderProvider();

    await waitFor(() => {
      expect(getByTestId('use-proxy').textContent).toBe('true');
    });
  });

  it('provides the preferences of the new user after a user switch', async () => {
    const { getByTestId } = renderProvider();
    await waitFor(() => {
      expect(getByTestId('use-proxy').textContent).toBe('true');
    });

    await act(async () => {
      await switchUser(db, 'user-b');
    });

    await waitFor(() => {
      expect(getByTestId('use-proxy').textContent).toBe('false');
    });
  });

  it('never gives the new user the preferences of the previous user', async () => {
    renders.length = 0;
    const { getByTestId } = render(
      <TestProviders db={db}>
        <UserProvider>
          <UserPreferencesProvider>
            <ProxySetting />
            <RecordedProxySetting />
          </UserPreferencesProvider>
        </UserProvider>
      </TestProviders>,
    );
    await waitFor(() => {
      expect(getByTestId('use-proxy').textContent).toBe('true');
    });

    await act(async () => {
      await switchUser(db, 'user-b');
    });
    await waitFor(() => {
      expect(getByTestId('use-proxy').textContent).toBe('false');
    });

    expect(renders).toContain('user-b: false');
    expect(renders).not.toContain('user-b: true');
  });

  it('provides changes made after a user switch', async () => {
    const { getByTestId } = renderProvider();
    await waitFor(() => {
      expect(getByTestId('use-proxy').textContent).toBe('true');
    });
    await act(async () => {
      await switchUser(db, 'user-b');
    });
    await waitFor(() => {
      expect(getByTestId('use-proxy').textContent).toBe('false');
    });

    await act(async () => {
      await updateUserPreferences(db, 'user-b', { use_proxy: true });
    });

    await waitFor(() => {
      expect(getByTestId('use-proxy').textContent).toBe('true');
    });
  });
});
