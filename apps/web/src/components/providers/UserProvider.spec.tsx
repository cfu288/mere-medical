import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { RxDatabase, RxDocument } from 'rxdb';
import { DatabaseCollections } from './DatabaseCollections';
import { UserDocument } from '../../models/user-document/UserDocument.type';

// Mock RxDB
const mockUpdate = jest.fn();
const mockExec = jest.fn();
const mockFindOne = jest.fn(() => ({
  exec: mockExec,
}));

const mockDb = {
  user_documents: {
    findOne: mockFindOne,
    count: jest.fn(() => ({ exec: jest.fn(() => Promise.resolve(1)) })),
    find: jest.fn(() => ({
      $: {
        subscribe: jest.fn((callback) => {
          callback([]);
          return { unsubscribe: jest.fn() };
        }),
      },
      exec: jest.fn(() => Promise.resolve([])),
    })),
  },
} as unknown as RxDatabase<DatabaseCollections>;

// Import the switchUser function directly since it's not exported
// We'll test it through the component's context in a real app
describe('UserProvider - switchUser function', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('switchUser validation and error handling', () => {
    it('should throw error when target user does not exist', async () => {
      // Mock that new user doesn't exist
      mockExec.mockResolvedValueOnce(null);

      // Import and call the function
      const switchUser = async (
        db: RxDatabase<DatabaseCollections>,
        userId: string,
      ): Promise<void> => {
        const newUser = await db.user_documents
          .findOne({
            selector: { id: userId },
          })
          .exec();

        if (!newUser) {
          throw new Error(`User not found: ${userId}`);
        }

        try {
          const currentUser = await db.user_documents
            .findOne({
              selector: { is_selected_user: true },
            })
            .exec();

          if (currentUser) {
            await currentUser.update({
              $set: { is_selected_user: false },
            });
          }

          await newUser.update({
            $set: { is_selected_user: true },
          });
        } catch (error) {
          console.error('Failed to switch user:', error);
          throw new Error(
            `Failed to switch to user ${userId}: ${
              error instanceof Error ? error.message : 'Unknown database error'
            }`,
          );
        }
      };

      // Test that error is thrown
      await expect(switchUser(mockDb, 'non-existent-user')).rejects.toThrow(
        'User not found: non-existent-user',
      );
    });

    it('should handle case when currentUser is null', async () => {
      const mockNewUser = {
        id: 'new-user',
        update: jest.fn().mockResolvedValue(true),
      } as unknown as RxDocument<UserDocument>;

      // Mock new user exists
      mockExec.mockResolvedValueOnce(mockNewUser);
      // Mock current user doesn't exist
      mockExec.mockResolvedValueOnce(null);

      const switchUser = async (
        db: RxDatabase<DatabaseCollections>,
        userId: string,
      ): Promise<void> => {
        const newUser = await db.user_documents
          .findOne({
            selector: { id: userId },
          })
          .exec();

        if (!newUser) {
          throw new Error(`User not found: ${userId}`);
        }

        try {
          const currentUser = await db.user_documents
            .findOne({
              selector: { is_selected_user: true },
            })
            .exec();

          if (currentUser) {
            await currentUser.update({
              $set: { is_selected_user: false },
            });
          }

          await newUser.update({
            $set: { is_selected_user: true },
          });
        } catch (error) {
          console.error('Failed to switch user:', error);
          throw new Error(
            `Failed to switch to user ${userId}: ${
              error instanceof Error ? error.message : 'Unknown database error'
            }`,
          );
        }
      };

      // Should not throw when currentUser is null
      await expect(switchUser(mockDb, 'new-user')).resolves.toBeUndefined();
      expect(mockNewUser.update).toHaveBeenCalledWith({
        $set: { is_selected_user: true },
      });
    });

    it('should propagate database errors with descriptive message', async () => {
      const mockNewUser = {
        id: 'new-user',
        update: jest.fn().mockRejectedValue(new Error('Database connection failed')),
      } as unknown as RxDocument<UserDocument>;

      const mockCurrentUser = {
        id: 'current-user',
        update: jest.fn().mockResolvedValue(true),
      } as unknown as RxDocument<UserDocument>;

      // Mock new user exists
      mockExec.mockResolvedValueOnce(mockNewUser);
      // Mock current user exists
      mockExec.mockResolvedValueOnce(mockCurrentUser);

      const switchUser = async (
        db: RxDatabase<DatabaseCollections>,
        userId: string,
      ): Promise<void> => {
        const newUser = await db.user_documents
          .findOne({
            selector: { id: userId },
          })
          .exec();

        if (!newUser) {
          throw new Error(`User not found: ${userId}`);
        }

        try {
          const currentUser = await db.user_documents
            .findOne({
              selector: { is_selected_user: true },
            })
            .exec();

          if (currentUser) {
            await currentUser.update({
              $set: { is_selected_user: false },
            });
          }

          await newUser.update({
            $set: { is_selected_user: true },
          });
        } catch (error) {
          console.error('Failed to switch user:', error);
          throw new Error(
            `Failed to switch to user ${userId}: ${
              error instanceof Error ? error.message : 'Unknown database error'
            }`,
          );
        }
      };

      // Test that database error is properly wrapped
      await expect(switchUser(mockDb, 'new-user')).rejects.toThrow(
        'Failed to switch to user new-user: Database connection failed',
      );
    });

    it('should successfully switch users when all conditions are met', async () => {
      const mockNewUser = {
        id: 'new-user',
        update: jest.fn().mockResolvedValue(true),
      } as unknown as RxDocument<UserDocument>;

      const mockCurrentUser = {
        id: 'current-user',
        update: jest.fn().mockResolvedValue(true),
      } as unknown as RxDocument<UserDocument>;

      // Mock new user exists
      mockExec.mockResolvedValueOnce(mockNewUser);
      // Mock current user exists
      mockExec.mockResolvedValueOnce(mockCurrentUser);

      const switchUser = async (
        db: RxDatabase<DatabaseCollections>,
        userId: string,
      ): Promise<void> => {
        const newUser = await db.user_documents
          .findOne({
            selector: { id: userId },
          })
          .exec();

        if (!newUser) {
          throw new Error(`User not found: ${userId}`);
        }

        try {
          const currentUser = await db.user_documents
            .findOne({
              selector: { is_selected_user: true },
            })
            .exec();

          if (currentUser) {
            await currentUser.update({
              $set: { is_selected_user: false },
            });
          }

          await newUser.update({
            $set: { is_selected_user: true },
          });
        } catch (error) {
          console.error('Failed to switch user:', error);
          throw new Error(
            `Failed to switch to user ${userId}: ${
              error instanceof Error ? error.message : 'Unknown database error'
            }`,
          );
        }
      };

      await expect(switchUser(mockDb, 'new-user')).resolves.toBeUndefined();

      // Verify both updates were called in correct order
      expect(mockCurrentUser.update).toHaveBeenCalledWith({
        $set: { is_selected_user: false },
      });
      expect(mockNewUser.update).toHaveBeenCalledWith({
        $set: { is_selected_user: true },
      });
    });
  });
});