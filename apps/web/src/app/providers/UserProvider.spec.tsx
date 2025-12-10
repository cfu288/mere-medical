import React from 'react';
import { render, waitFor, act } from '@testing-library/react';
import { RxDatabase } from 'rxdb';
import { DatabaseCollections } from './DatabaseCollections';
import {
  UserProvider,
  useUser,
  useRxUserDocument,
  useAllUsers,
  useUserManagement,
} from './UserProvider';
import { TestProviders } from '../../test-utils/TestProviders';
import {
  createTestDatabase,
  cleanupTestDatabase,
} from '../../test-utils/createTestDatabase';
import {
  createTestUser,
  createMultipleTestUsers,
} from '../../test-utils/userTestData';
import { UserDocument } from '../../models/user-document/UserDocument.type';

describe('UserProvider', () => {
  let db: RxDatabase<DatabaseCollections>;

  beforeEach(async () => {
    db = await createTestDatabase();
  });

  afterEach(async () => {
    await cleanupTestDatabase(db);
  });

  describe('default user creation', () => {
    it('creates a default user on mount when no users exist', async () => {
      const TestComponent = () => {
        const user = useUser();
        return (
          <div>
            <span data-testid="user-id">{user.id}</span>
            <span data-testid="is-default">{String(user.is_default_user)}</span>
            <span data-testid="is-selected">
              {String(user.is_selected_user)}
            </span>
          </div>
        );
      };

      const { getByTestId } = render(
        <TestProviders db={db}>
          <UserProvider>
            <TestComponent />
          </UserProvider>
        </TestProviders>,
      );

      await waitFor(async () => {
        const userDocs = await db.user_documents.find().exec();
        expect(userDocs).toHaveLength(1);
      });

      await waitFor(() => {
        expect(getByTestId('user-id')).toBeTruthy();
        expect(getByTestId('is-default').textContent).toBe('true');
        expect(getByTestId('is-selected').textContent).toBe('true');
      });
    });

    it('does not create a new user when one already exists', async () => {
      // Pre-seed database with a user
      const existingUser = createTestUser({ is_selected_user: true });
      await db.user_documents.insert(existingUser);

      const TestComponent = () => {
        const user = useUser();
        return <div data-testid="user-id">{user.id}</div>;
      };

      const { getByTestId } = render(
        <TestProviders db={db}>
          <UserProvider>
            <TestComponent />
          </UserProvider>
        </TestProviders>,
      );

      await waitFor(() => {
        expect(getByTestId('user-id').textContent).toBe(existingUser.id);
      });

      // Verify no additional user was created
      const userDocs = await db.user_documents.find().exec();
      expect(userDocs).toHaveLength(1);
    });
  });

  describe('user context provision', () => {
    it('provides user data through useUser hook', async () => {
      const testUser = createTestUser({
        is_selected_user: true,
        first_name: 'John',
        last_name: 'Doe',
        email: 'john@example.com',
      });
      await db.user_documents.insert(testUser);

      const TestComponent = () => {
        const user = useUser();
        return (
          <div>
            <span data-testid="name">{`${user.first_name} ${user.last_name}`}</span>
            <span data-testid="email">{user.email}</span>
          </div>
        );
      };

      const { getByTestId } = render(
        <TestProviders db={db}>
          <UserProvider>
            <TestComponent />
          </UserProvider>
        </TestProviders>,
      );

      await waitFor(() => {
        expect(getByTestId('name').textContent).toBe('John Doe');
        expect(getByTestId('email').textContent).toBe('john@example.com');
      });
    });

    it('provides RxDocument through useRxUserDocument hook', async () => {
      const testUser = createTestUser({ is_selected_user: true });
      await db.user_documents.insert(testUser);

      const TestComponent = () => {
        const rawUser = useRxUserDocument();
        return (
          <div>
            <span data-testid="has-rxdoc">{String(rawUser !== null)}</span>
            {rawUser && (
              <span data-testid="can-update">
                {String(typeof rawUser.update === 'function')}
              </span>
            )}
          </div>
        );
      };

      const { getByTestId } = render(
        <TestProviders db={db}>
          <UserProvider>
            <TestComponent />
          </UserProvider>
        </TestProviders>,
      );

      await waitFor(() => {
        expect(getByTestId('has-rxdoc').textContent).toBe('true');
        expect(getByTestId('can-update').textContent).toBe('true');
      });
    });

    it('provides all users through useAllUsers hook', async () => {
      const users = createMultipleTestUsers(3);
      for (const user of users) {
        await db.user_documents.insert(user);
      }

      const TestComponent = () => {
        const allUsers = useAllUsers();
        // Sort users by first_name for consistent test results
        const sortedUsers = [...allUsers].sort((a, b) =>
          a.get('first_name').localeCompare(b.get('first_name')),
        );
        return (
          <div>
            <span data-testid="user-count">{allUsers.length}</span>
            {sortedUsers.map((user, index) => (
              <span key={user.id} data-testid={`user-${index}`}>
                {user.get('first_name')}
              </span>
            ))}
          </div>
        );
      };

      const { getByTestId } = render(
        <TestProviders db={db}>
          <UserProvider>
            <TestComponent />
          </UserProvider>
        </TestProviders>,
      );

      await waitFor(() => {
        expect(getByTestId('user-count').textContent).toBe('3');
        expect(getByTestId('user-0').textContent).toBe('Test1');
        expect(getByTestId('user-1').textContent).toBe('Test2');
        expect(getByTestId('user-2').textContent).toBe('Test3');
      });
    });
  });

  describe('user management', () => {
    it('switches between users', async () => {
      const users = createMultipleTestUsers(2);
      for (const user of users) {
        await db.user_documents.insert(user);
      }

      let currentUserId: string = '';

      const TestComponent = () => {
        const user = useUser();
        const { switchUser } = useUserManagement();

        currentUserId = user.id;

        return (
          <div>
            <span data-testid="current-user">{user.first_name}</span>
            <button
              data-testid="switch-button"
              onClick={() => switchUser(users[1].id)}
            >
              Switch User
            </button>
          </div>
        );
      };

      const { getByTestId } = render(
        <TestProviders db={db}>
          <UserProvider>
            <TestComponent />
          </UserProvider>
        </TestProviders>,
      );

      await waitFor(() => {
        expect(getByTestId('current-user').textContent).toBe('Test1');
      });

      // Switch to second user
      await act(async () => {
        getByTestId('switch-button').click();
      });

      await waitFor(() => {
        expect(getByTestId('current-user').textContent).toBe('Test2');
        expect(currentUserId).toBe(users[1].id);
      });

      // Verify database state
      const selectedUser = await db.user_documents
        .findOne({ selector: { is_selected_user: true } })
        .exec();
      expect(selectedUser?.id).toBe(users[1].id);
    });

    it('creates a new user', async () => {
      const TestComponent = () => {
        const allUsers = useAllUsers();
        const { createNewUser } = useUserManagement();

        return (
          <div>
            <span data-testid="user-count">{allUsers.length}</span>
            <button
              data-testid="create-button"
              onClick={async () => {
                await createNewUser({
                  first_name: 'New',
                  last_name: 'User',
                  email: 'new@example.com',
                });
              }}
            >
              Create User
            </button>
          </div>
        );
      };

      const { getByTestId } = render(
        <TestProviders db={db}>
          <UserProvider>
            <TestComponent />
          </UserProvider>
        </TestProviders>,
      );

      // Wait for default user creation
      await waitFor(() => {
        expect(getByTestId('user-count').textContent).toBe('1');
      });

      // Create new user
      await act(async () => {
        getByTestId('create-button').click();
      });

      await waitFor(() => {
        expect(getByTestId('user-count').textContent).toBe('2');
      });

      // Verify the new user was created correctly
      const allUsers = await db.user_documents.find().exec();
      expect(allUsers).toHaveLength(2);

      const newUser = allUsers.find(
        (u) => u.get('email') === 'new@example.com',
      );
      expect(newUser).toBeTruthy();
      expect(newUser?.get('first_name')).toBe('New');
      expect(newUser?.get('last_name')).toBe('User');
      expect(newUser?.get('is_selected_user')).toBe(false);
    });
  });

  describe('reactive updates', () => {
    it('updates when user data changes', async () => {
      const testUser = createTestUser({
        is_selected_user: true,
        first_name: 'Initial',
      });
      await db.user_documents.insert(testUser);

      const TestComponent = () => {
        const user = useUser();
        const rawUser = useRxUserDocument();

        return (
          <div>
            <span data-testid="first-name">{user.first_name}</span>
            <button
              data-testid="update-button"
              onClick={async () => {
                if (rawUser) {
                  await rawUser.update({
                    $set: { first_name: 'Updated' },
                  });
                }
              }}
            >
              Update Name
            </button>
          </div>
        );
      };

      const { getByTestId } = render(
        <TestProviders db={db}>
          <UserProvider>
            <TestComponent />
          </UserProvider>
        </TestProviders>,
      );

      await waitFor(() => {
        expect(getByTestId('first-name').textContent).toBe('Initial');
      });

      // Update the user's name
      await act(async () => {
        getByTestId('update-button').click();
      });

      await waitFor(() => {
        expect(getByTestId('first-name').textContent).toBe('Updated');
      });
    });

    it('updates when a new user is added', async () => {
      const TestComponent = () => {
        const allUsers = useAllUsers();
        return <span data-testid="count">{allUsers.length}</span>;
      };

      const { getByTestId } = render(
        <TestProviders db={db}>
          <UserProvider>
            <TestComponent />
          </UserProvider>
        </TestProviders>,
      );

      await waitFor(() => {
        expect(getByTestId('count').textContent).toBe('1'); // Default user
      });

      // Add a new user directly to database
      await act(async () => {
        await db.user_documents.insert(createTestUser());
      });

      await waitFor(() => {
        expect(getByTestId('count').textContent).toBe('2');
      });
    });
  });

  describe('error handling', () => {
    it('throws error when hooks are used outside provider', () => {
      const TestComponent = () => {
        try {
          useUser();
          return <div>Should not render</div>;
        } catch (error) {
          return <div data-testid="error">{(error as Error).message}</div>;
        }
      };

      // Suppress console.error for this test
      const originalError = console.error;
      console.error = jest.fn();

      const { getByTestId } = render(<TestComponent />);
      expect(getByTestId('error').textContent).toContain(
        'useUser must be used within a UserProvider',
      );

      console.error = originalError;
    });
  });
});
