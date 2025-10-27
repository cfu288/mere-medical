import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { RxDatabase, RxDocument } from 'rxdb';
import { getConnectionCardByUrl } from './getConnectionCardByUrl';
import { DatabaseCollections } from '../components/providers/DatabaseCollections';
import { ConnectionDocument } from '../models/connection-document/ConnectionDocument.type';

describe('getConnectionCardByUrl', () => {
  let mockDb: RxDatabase<DatabaseCollections>;
  let mockExec: jest.Mock;
  let mockFindOne: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockExec = jest.fn();
    mockFindOne = jest.fn(() => ({
      exec: mockExec,
    }));

    mockDb = {
      connection_documents: {
        findOne: mockFindOne,
      },
    } as unknown as RxDatabase<DatabaseCollections>;
  });

  describe('Connection isolation by user', () => {
    it('should include user_id in the query selector', async () => {
      const mockConnection = {
        id: 'conn-1',
        location: 'https://example.com',
        user_id: 'user-123',
      } as RxDocument<ConnectionDocument>;

      mockExec.mockResolvedValue(mockConnection);

      await getConnectionCardByUrl(
        'https://example.com',
        mockDb,
        'user-123',
      );

      // Verify findOne was called with correct selector including user_id
      expect(mockFindOne).toHaveBeenCalledWith({
        selector: {
          location: 'https://example.com',
          user_id: 'user-123',
        },
      });
    });

    it('should return null when connection exists for different user', async () => {
      // Mock that no connection is found for this user
      mockExec.mockResolvedValue(null);

      const result = await getConnectionCardByUrl(
        'https://example.com',
        mockDb,
        'user-456',
      );

      expect(result).toBeNull();
      expect(mockFindOne).toHaveBeenCalledWith({
        selector: {
          location: 'https://example.com',
          user_id: 'user-456',
        },
      });
    });

    it('should return the correct connection for the specified user', async () => {
      const mockConnection = {
        id: 'conn-1',
        location: 'https://example.com',
        user_id: 'user-123',
        name: 'Test Hospital',
      } as RxDocument<ConnectionDocument>;

      mockExec.mockResolvedValue(mockConnection);

      const result = await getConnectionCardByUrl(
        'https://example.com',
        mockDb,
        'user-123',
      );

      expect(result).toBe(mockConnection);
    });

    it('should work with Location object as url parameter', async () => {
      const mockLocation = {
        href: 'https://example.com',
      } as Location;

      const mockConnection = {
        id: 'conn-1',
        location: mockLocation,
        user_id: 'user-789',
      } as RxDocument<ConnectionDocument>;

      mockExec.mockResolvedValue(mockConnection);

      await getConnectionCardByUrl(mockLocation, mockDb, 'user-789');

      expect(mockFindOne).toHaveBeenCalledWith({
        selector: {
          location: mockLocation,
          user_id: 'user-789',
        },
      });
    });
  });

  describe('Security validation', () => {
    it('should not return connections from other users', async () => {
      // This test ensures that even if the database somehow has a connection
      // for a different user at the same URL, it won't be returned
      const userAConnection = {
        id: 'conn-a',
        location: 'https://shared-hospital.com',
        user_id: 'user-a',
        access_token: 'token-a',
      };

      const userBConnection = {
        id: 'conn-b',
        location: 'https://shared-hospital.com',
        user_id: 'user-b',
        access_token: 'token-b',
      };

      // Simulate database behavior where it only returns matching user_id
      mockExec.mockImplementation(() => {
        const selector = mockFindOne.mock.calls[mockFindOne.mock.calls.length - 1][0].selector;
        if (selector.user_id === 'user-a') {
          return Promise.resolve(userAConnection);
        } else if (selector.user_id === 'user-b') {
          return Promise.resolve(userBConnection);
        }
        return Promise.resolve(null);
      });

      // User A should only get their connection
      const resultA = await getConnectionCardByUrl(
        'https://shared-hospital.com',
        mockDb,
        'user-a',
      );
      expect(resultA).toBe(userAConnection);

      // User B should only get their connection
      const resultB = await getConnectionCardByUrl(
        'https://shared-hospital.com',
        mockDb,
        'user-b',
      );
      expect(resultB).toBe(userBConnection);

      // User C should get null (no connection)
      const resultC = await getConnectionCardByUrl(
        'https://shared-hospital.com',
        mockDb,
        'user-c',
      );
      expect(resultC).toBeNull();
    });
  });
});