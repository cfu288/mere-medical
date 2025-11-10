import React from 'react';
import { render, waitFor, act } from '@testing-library/react';
import { RxDatabase } from 'rxdb';
import { DatabaseCollections } from './DatabaseCollections';
import {
  UserPreferencesProvider,
  useUserPreferences,
  useRawUserPreferences,
} from './UserPreferencesProvider';
import { UserProvider } from './UserProvider';
import { TestProviders } from '../../test-utils/TestProviders';
import { createTestDatabase, cleanupTestDatabase } from '../../test-utils/createTestDatabase';
import { createTestUser } from '../../test-utils/userTestData';
import * as UserPreferencesRepo from '../../repositories/UserPreferencesRepository';

describe('UserPreferencesProvider', () => {
  let db: RxDatabase<DatabaseCollections>;

  beforeEach(async () => {
    db = await createTestDatabase();
  });

  afterEach(async () => {
    await cleanupTestDatabase(db);
  });

  describe('preference initialization', () => {
    it('provides user preferences through useUserPreferences hook', async () => {
      const testUser = createTestUser({ is_selected_user: true });
      await db.user_documents.insert(testUser);

      await db.user_preferences.insert({
        id: 'pref1',
        user_id: testUser.id,
        use_proxy: false,
      });

      const TestComponent = () => {
        const preferences = useUserPreferences();
        return (
          <div>
            {preferences && (
              <>
                <span data-testid="use-proxy">{String(preferences.use_proxy)}</span>
                <span data-testid="user-id">{preferences.user_id}</span>
              </>
            )}
          </div>
        );
      };

      const { getByTestId } = render(
        <TestProviders db={db}>
          <UserProvider>
            <UserPreferencesProvider>
              <TestComponent />
            </UserPreferencesProvider>
          </UserProvider>
        </TestProviders>
      );

      await waitFor(() => {
        expect(getByTestId('use-proxy').textContent).toBe('false');
        expect(getByTestId('user-id').textContent).toBe(testUser.id);
      });
    });

    it('creates preferences with defaults if none exist', async () => {
      const testUser = createTestUser({ is_selected_user: true });
      await db.user_documents.insert(testUser);

      const TestComponent = () => {
        const preferences = useUserPreferences();
        return (
          <div>
            {preferences && (
              <span data-testid="use-proxy">{String(preferences.use_proxy)}</span>
            )}
          </div>
        );
      };

      const { getByTestId } = render(
        <TestProviders db={db}>
          <UserProvider>
            <UserPreferencesProvider>
              <TestComponent />
            </UserPreferencesProvider>
          </UserProvider>
        </TestProviders>
      );

      await waitFor(() => {
        expect(getByTestId('use-proxy').textContent).toBe('true'); // Default value
      });

      // Verify preferences were created in database
      const prefs = await db.user_preferences
        .findOne({ selector: { user_id: testUser.id } })
        .exec();
      expect(prefs).toBeTruthy();
    });
  });

  describe('user switching', () => {
    it('should re-initialize preferences when switching users', async () => {
      // Create two users with different preferences
      const user1 = createTestUser({
        id: 'user-1',
        is_selected_user: true,
        first_name: 'Alice'
      });
      const user2 = createTestUser({
        id: 'user-2',
        is_selected_user: false,
        first_name: 'Bob'
      });

      await db.user_documents.insert(user1);
      await db.user_documents.insert(user2);

      // Set different preferences for each user
      await db.user_preferences.insert({
        id: 'pref-1',
        user_id: 'user-1',
        use_proxy: false,
      });

      await db.user_preferences.insert({
        id: 'pref-2',
        user_id: 'user-2',
        use_proxy: true,
      });

      const TestComponent = () => {
        const preferences = useUserPreferences();
        return (
          <div>
            {preferences && (
              <>
                <span data-testid="use-proxy">{String(preferences.use_proxy)}</span>
                <span data-testid="pref-user-id">{preferences.user_id}</span>
              </>
            )}
          </div>
        );
      };

      const { getByTestId, rerender } = render(
        <TestProviders db={db}>
          <UserProvider>
            <UserPreferencesProvider>
              <TestComponent />
            </UserPreferencesProvider>
          </UserProvider>
        </TestProviders>
      );

      // Initially should show user1's preferences
      await waitFor(() => {
        expect(getByTestId('use-proxy').textContent).toBe('false');
        expect(getByTestId('pref-user-id').textContent).toBe('user-1');
      });

      // Switch to user2
      await act(async () => {
        // Update user1 to not be selected
        const user1Doc = await db.user_documents
          .findOne({ selector: { id: 'user-1' } })
          .exec();
        await user1Doc?.update({ $set: { is_selected_user: false } });

        // Update user2 to be selected
        const user2Doc = await db.user_documents
          .findOne({ selector: { id: 'user-2' } })
          .exec();
        await user2Doc?.update({ $set: { is_selected_user: true } });
      });

      // Wait a bit for updates to propagate
      await new Promise(resolve => setTimeout(resolve, 100));

      // Re-render to trigger effect re-run
      rerender(
        <TestProviders db={db}>
          <UserProvider>
            <UserPreferencesProvider>
              <TestComponent />
            </UserPreferencesProvider>
          </UserProvider>
        </TestProviders>
      );

      // Should now show user2's preferences
      await waitFor(() => {
        expect(getByTestId('use-proxy').textContent).toBe('true');
        expect(getByTestId('pref-user-id').textContent).toBe('user-2');
      }, { timeout: 3000 });
    });
  });

  describe('database switching', () => {
    it('should re-initialize preferences when database changes', async () => {
      let db2: RxDatabase<DatabaseCollections>;

      try {
        // Create first database with user and preferences
        const user1 = createTestUser({
          id: 'user-1',
          is_selected_user: true
        });
        await db.user_documents.insert(user1);
        await db.user_preferences.insert({
          id: 'pref-1',
          user_id: 'user-1',
          use_proxy: false,
        });

        // Create second database with different user and preferences
        db2 = await createTestDatabase();
        const user2 = createTestUser({
          id: 'user-2',
          is_selected_user: true
        });
        await db2.user_documents.insert(user2);
        await db2.user_preferences.insert({
          id: 'pref-2',
          user_id: 'user-2',
          use_proxy: true,
        });

        const TestComponent = () => {
          const preferences = useUserPreferences();
          return (
            <div>
              {preferences && (
                <>
                  <span data-testid="use-proxy">{String(preferences.use_proxy)}</span>
                  <span data-testid="pref-user-id">{preferences.user_id}</span>
                </>
              )}
            </div>
          );
        };

        // Start with first database
        const { getByTestId, rerender } = render(
          <TestProviders db={db}>
            <UserProvider>
              <UserPreferencesProvider>
                <TestComponent />
              </UserPreferencesProvider>
            </UserProvider>
          </TestProviders>
        );

        // Should show first database preferences
        await waitFor(() => {
          expect(getByTestId('use-proxy').textContent).toBe('false');
          expect(getByTestId('pref-user-id').textContent).toBe('user-1');
        });

        // Switch to second database
        rerender(
          <TestProviders db={db2}>
            <UserProvider>
              <UserPreferencesProvider>
                <TestComponent />
              </UserPreferencesProvider>
            </UserProvider>
          </TestProviders>
        );

        // Should now show second database preferences
        await waitFor(() => {
          expect(getByTestId('use-proxy').textContent).toBe('true');
          expect(getByTestId('pref-user-id').textContent).toBe('user-2');
        }, { timeout: 3000 });
      } finally {
        if (db2!) {
          await cleanupTestDatabase(db2);
        }
      }
    });
  });

  describe('reactive updates', () => {
    it('updates when preferences change', async () => {
      const testUser = createTestUser({ is_selected_user: true });
      await db.user_documents.insert(testUser);

      await db.user_preferences.insert({
        id: 'pref1',
        user_id: testUser.id,
        use_proxy: true,
      });

      const TestComponent = () => {
        const preferences = useUserPreferences();
        const rawPreferences = useRawUserPreferences();

        return (
          <div>
            {preferences && (
              <>
                <span data-testid="use-proxy">{String(preferences.use_proxy)}</span>
                <button
                  data-testid="toggle-proxy"
                  onClick={async () => {
                    if (rawPreferences) {
                      await rawPreferences.update({
                        $set: { use_proxy: !preferences.use_proxy }
                      });
                    }
                  }}
                >
                  Toggle Proxy
                </button>
              </>
            )}
          </div>
        );
      };

      const { getByTestId } = render(
        <TestProviders db={db}>
          <UserProvider>
            <UserPreferencesProvider>
              <TestComponent />
            </UserPreferencesProvider>
          </UserProvider>
        </TestProviders>
      );

      await waitFor(() => {
        expect(getByTestId('use-proxy').textContent).toBe('true');
      });

      // Toggle the proxy setting
      await act(async () => {
        getByTestId('toggle-proxy').click();
      });

      await waitFor(() => {
        expect(getByTestId('use-proxy').textContent).toBe('false');
      });
    });
  });

  describe('error handling', () => {
    it('handles missing user gracefully', async () => {
      const TestComponent = () => {
        const preferences = useUserPreferences();
        return (
          <div>
            <span data-testid="has-prefs">{String(preferences !== undefined)}</span>
          </div>
        );
      };

      // No user in database - UserProvider will create a default one
      const { getByTestId } = render(
        <TestProviders db={db}>
          <UserProvider>
            <UserPreferencesProvider>
              <TestComponent />
            </UserPreferencesProvider>
          </UserProvider>
        </TestProviders>
      );

      await waitFor(() => {
        expect(getByTestId('has-prefs').textContent).toBe('true');
      });
    });
  });
});