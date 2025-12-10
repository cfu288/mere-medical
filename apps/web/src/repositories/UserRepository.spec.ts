import { RxDatabase } from 'rxdb';
import { DatabaseCollections } from '../app/providers/DatabaseCollections';
import {
  createTestDatabase,
  cleanupTestDatabase,
} from '../test-utils/createTestDatabase';
import {
  createTestUser,
  createMultipleTestUsers,
  createSelectedTestUser,
} from '../test-utils/userTestData';
import * as userRepo from './UserRepository';
import { firstValueFrom } from 'rxjs';

describe('userRepository', () => {
  let db: RxDatabase<DatabaseCollections>;

  beforeEach(async () => {
    db = await createTestDatabase();
  });

  afterEach(async () => {
    await cleanupTestDatabase(db);
  });

  describe('query functions', () => {
    describe('findUserById', () => {
      it('returns user when found', async () => {
        const testUser = createTestUser();
        await db.user_documents.insert(testUser);

        const result = await userRepo.findUserById(db, testUser.id);

        expect(result).toBeTruthy();
        expect(result?.id).toBe(testUser.id);
        expect(result?.first_name).toBe(testUser.first_name);
      });

      it('returns null when user not found', async () => {
        const result = await userRepo.findUserById(db, 'non-existent-id');
        expect(result).toBeNull();
      });
    });

    describe('findSelectedUser', () => {
      it('returns selected user', async () => {
        const selectedUser = createSelectedTestUser({ first_name: 'Selected' });
        const otherUser = createTestUser({ first_name: 'Other' });
        await db.user_documents.insert(selectedUser);
        await db.user_documents.insert(otherUser);

        const result = await userRepo.findSelectedUser(db);

        expect(result).toBeTruthy();
        expect(result?.id).toBe(selectedUser.id);
        expect(result?.first_name).toBe('Selected');
        expect(result?.is_selected_user).toBe(true);
      });

      it('returns null when no selected user', async () => {
        const user = createTestUser({ is_selected_user: false });
        await db.user_documents.insert(user);

        const result = await userRepo.findSelectedUser(db);
        expect(result).toBeNull();
      });
    });

    describe('findAllUsers', () => {
      it('returns all users', async () => {
        const users = createMultipleTestUsers(3);
        for (const user of users) {
          await db.user_documents.insert(user);
        }

        const result = await userRepo.findAllUsers(db);

        expect(result).toHaveLength(3);
        const firstNames = result.map((u) => u.first_name).sort();
        expect(firstNames).toEqual(['Test1', 'Test2', 'Test3']);
      });

      it('returns empty array when no users', async () => {
        const result = await userRepo.findAllUsers(db);
        expect(result).toEqual([]);
      });
    });

    describe('userExists', () => {
      it('returns true when users exist', async () => {
        await db.user_documents.insert(createTestUser());

        const result = await userRepo.userExists(db);
        expect(result).toBe(true);
      });

      it('returns false when no users exist', async () => {
        const result = await userRepo.userExists(db);
        expect(result).toBe(false);
      });
    });

    describe('findSelectedUserWithDoc', () => {
      it('returns both user object and RxDocument', async () => {
        const selectedUser = createSelectedTestUser({ first_name: 'Test' });
        await db.user_documents.insert(selectedUser);

        const result = await userRepo.findSelectedUserWithDoc(db);

        expect(result.user).toBeTruthy();
        expect(result.user.first_name).toBe('Test');
        expect(result.rawUser).toBeTruthy();
        expect(typeof result.rawUser?.update).toBe('function');
      });

      it('returns default user when no selected user exists', async () => {
        const result = await userRepo.findSelectedUserWithDoc(db);

        expect(result.user).toBeTruthy();
        expect(result.user.is_default_user).toBe(true);
        expect(result.user.is_selected_user).toBe(true);
        expect(result.rawUser).toBeNull();
      });
    });

    describe('findAllUsersWithDocs', () => {
      it('returns RxDocuments for all users', async () => {
        const users = createMultipleTestUsers(2);
        for (const user of users) {
          await db.user_documents.insert(user);
        }

        const result = await userRepo.findAllUsersWithDocs(db);

        expect(result).toHaveLength(2);
        result.forEach((doc) => {
          expect(typeof doc.update).toBe('function');
        });
        const firstNames = result.map((d) => d.get('first_name')).sort();
        expect(firstNames).toEqual(['Test1', 'Test2']);
      });
    });
  });

  describe('reactive functions', () => {
    describe('watchSelectedUser', () => {
      it('emits updates when selected user changes', async () => {
        const user = createSelectedTestUser({ first_name: 'Initial' });
        await db.user_documents.insert(user);

        const observable = userRepo.watchSelectedUser(db);
        const values: any[] = [];
        const subscription = observable.subscribe((value) =>
          values.push(value),
        );

        // Wait for initial value
        await new Promise((resolve) => setTimeout(resolve, 100));

        // Update user
        const userDoc = await db.user_documents
          .findOne({ selector: { id: user.id } })
          .exec();
        await userDoc?.update({ $set: { first_name: 'Updated' } });

        // Wait for update
        await new Promise((resolve) => setTimeout(resolve, 100));

        subscription.unsubscribe();

        expect(values.length).toBeGreaterThan(1);
        expect(values[0].user.first_name).toBe('Initial');
        expect(values[values.length - 1].user.first_name).toBe('Updated');
      });
    });

    describe('watchAllUsers', () => {
      it('emits when users are added', async () => {
        const observable = userRepo.watchAllUsers(db);
        const values: any[] = [];
        const subscription = observable.subscribe((value) =>
          values.push(value),
        );

        // Add first user
        await db.user_documents.insert(createTestUser({ first_name: 'User1' }));
        await new Promise((resolve) => setTimeout(resolve, 100));

        // Add second user
        await db.user_documents.insert(createTestUser({ first_name: 'User2' }));
        await new Promise((resolve) => setTimeout(resolve, 100));

        subscription.unsubscribe();

        expect(values.length).toBeGreaterThan(1);
        expect(values[values.length - 1]).toHaveLength(2);
      });
    });

    describe('watchAllUsersWithDocs', () => {
      it('emits RxDocuments when users change', async () => {
        await db.user_documents.insert(createTestUser());

        const observable = userRepo.watchAllUsersWithDocs(db);
        const firstValue = await firstValueFrom(observable);

        expect(firstValue).toHaveLength(1);
        expect(typeof firstValue[0].update).toBe('function');
      });
    });
  });

  describe('command functions', () => {
    describe('createUser', () => {
      it('creates a new user with provided data', async () => {
        const userData = {
          first_name: 'John',
          last_name: 'Doe',
          email: 'john@example.com',
        };

        const result = await userRepo.createUser(db, userData);

        expect(result).toBeTruthy();
        expect(result.get('first_name')).toBe('John');
        expect(result.get('last_name')).toBe('Doe');
        expect(result.get('email')).toBe('john@example.com');
        expect(result.get('is_selected_user')).toBe(false);
        expect(result.get('is_default_user')).toBe(false);

        // Verify in database
        const dbUser = await db.user_documents
          .findOne({ selector: { id: result.id } })
          .exec();
        expect(dbUser).toBeTruthy();
      });
    });

    describe('createDefaultUserIfNone', () => {
      it('creates default user when no users exist', async () => {
        const created = await userRepo.createDefaultUserIfNone(db);

        expect(created).toBe(true);

        const users = await db.user_documents.find().exec();
        expect(users).toHaveLength(1);
        expect(users[0].get('is_default_user')).toBe(true);
        expect(users[0].get('is_selected_user')).toBe(true);
      });

      it('does not create user when one exists', async () => {
        await db.user_documents.insert(createTestUser());

        const created = await userRepo.createDefaultUserIfNone(db);

        expect(created).toBe(false);

        const users = await db.user_documents.find().exec();
        expect(users).toHaveLength(1);
      });
    });

    describe('updateUser', () => {
      it('updates existing user', async () => {
        const user = createTestUser({ first_name: 'Original' });
        await db.user_documents.insert(user);

        await userRepo.updateUser(db, user.id, { first_name: 'Updated' });

        const updatedUser = await db.user_documents
          .findOne({ selector: { id: user.id } })
          .exec();
        expect(updatedUser?.get('first_name')).toBe('Updated');
      });

      it('throws error when user not found', async () => {
        await expect(
          userRepo.updateUser(db, 'non-existent', { first_name: 'Test' }),
        ).rejects.toThrow('User not found: non-existent');
      });
    });

    describe('switchUser', () => {
      it('switches selected user atomically', async () => {
        const user1 = createSelectedTestUser({ first_name: 'User1' });
        const user2 = createTestUser({ first_name: 'User2' });
        await db.user_documents.insert(user1);
        await db.user_documents.insert(user2);

        await userRepo.switchUser(db, user2.id);

        // Verify user2 is now selected
        const newSelected = await db.user_documents
          .findOne({ selector: { id: user2.id } })
          .exec();
        expect(newSelected?.get('is_selected_user')).toBe(true);

        // Verify user1 is no longer selected
        const oldSelected = await db.user_documents
          .findOne({ selector: { id: user1.id } })
          .exec();
        expect(oldSelected?.get('is_selected_user')).toBe(false);

        // Verify only one selected user
        const allSelected = await db.user_documents
          .find({ selector: { is_selected_user: true } })
          .exec();
        expect(allSelected).toHaveLength(1);
        expect(allSelected[0].id).toBe(user2.id);
      });

      it('throws error when user not found', async () => {
        await expect(userRepo.switchUser(db, 'non-existent')).rejects.toThrow(
          'User not found: non-existent',
        );
      });
    });

    describe('deleteUser', () => {
      it('deletes existing user', async () => {
        const user = createTestUser();
        await db.user_documents.insert(user);

        await userRepo.deleteUser(db, user.id);

        const deletedUser = await db.user_documents
          .findOne({ selector: { id: user.id } })
          .exec();
        expect(deletedUser).toBeNull();
      });

      it('throws error when user not found', async () => {
        await expect(userRepo.deleteUser(db, 'non-existent')).rejects.toThrow(
          'User not found: non-existent',
        );
      });
    });
  });

  describe('edge cases', () => {
    it('handles multiple selected users gracefully', async () => {
      // Manually create an invalid state with multiple selected users
      const user1 = createSelectedTestUser({ first_name: 'User1' });
      const user2 = createSelectedTestUser({ first_name: 'User2' });
      await db.user_documents.insert(user1);
      await db.user_documents.insert(user2);

      // Switch to user2 should clean up the invalid state
      await userRepo.switchUser(db, user2.id);

      const allSelected = await db.user_documents
        .find({ selector: { is_selected_user: true } })
        .exec();
      expect(allSelected).toHaveLength(1);
      expect(allSelected[0].id).toBe(user2.id);
    });

    it('handles concurrent updates without errors', async () => {
      const users = createMultipleTestUsers(3);
      for (const user of users) {
        await db.user_documents.insert(user);
      }

      // Perform multiple operations concurrently
      const operations = [
        userRepo.switchUser(db, users[1].id),
        userRepo.updateUser(db, users[0].id, { email: 'new@example.com' }),
        userRepo.findAllUsers(db),
      ];

      const results = await Promise.all(operations);

      // Verify all operations completed
      expect(results[2]).toHaveLength(3);
    });
  });
});
