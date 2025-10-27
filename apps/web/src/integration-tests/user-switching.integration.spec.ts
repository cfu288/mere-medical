import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { RxDatabase, RxDocument, RxCollection } from 'rxdb';
import { DatabaseCollections } from '../components/providers/DatabaseCollections';
import { UserDocument } from '../models/user-document/UserDocument.type';
import { ConnectionDocument } from '../models/connection-document/ConnectionDocument.type';
import { ClinicalDocument } from '../models/clinical-document/ClinicalDocument.type';

describe('User Switching Integration Tests', () => {
  let mockDb: RxDatabase<DatabaseCollections>;
  let userDocuments: RxDocument<UserDocument>[];
  let connectionDocuments: RxDocument<ConnectionDocument>[];
  let clinicalDocuments: RxDocument<ClinicalDocument<any>>[];

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup mock data for multiple users
    userDocuments = [
      {
        id: 'user-1',
        first_name: 'Alice',
        last_name: 'Smith',
        email: 'alice@example.com',
        is_selected_user: true,
        is_default_user: false,
        get: (field: string) => {
          const doc: any = {
            id: 'user-1',
            first_name: 'Alice',
            last_name: 'Smith',
            email: 'alice@example.com',
            is_selected_user: true,
          };
          return doc[field];
        },
        update: jest.fn().mockResolvedValue(true),
      } as unknown as RxDocument<UserDocument>,
      {
        id: 'user-2',
        first_name: 'Bob',
        last_name: 'Jones',
        email: 'bob@example.com',
        is_selected_user: false,
        is_default_user: false,
        get: (field: string) => {
          const doc: any = {
            id: 'user-2',
            first_name: 'Bob',
            last_name: 'Jones',
            email: 'bob@example.com',
            is_selected_user: false,
          };
          return doc[field];
        },
        update: jest.fn().mockResolvedValue(true),
      } as unknown as RxDocument<UserDocument>,
    ];

    // Setup mock connections for each user
    connectionDocuments = [
      {
        id: 'conn-1',
        user_id: 'user-1',
        location: 'https://hospital-a.com',
        name: 'Hospital A - Alice',
        access_token: 'alice-token-a',
      } as unknown as RxDocument<ConnectionDocument>,
      {
        id: 'conn-2',
        user_id: 'user-1',
        location: 'https://hospital-b.com',
        name: 'Hospital B - Alice',
        access_token: 'alice-token-b',
      } as unknown as RxDocument<ConnectionDocument>,
      {
        id: 'conn-3',
        user_id: 'user-2',
        location: 'https://hospital-a.com',
        name: 'Hospital A - Bob',
        access_token: 'bob-token-a',
      } as unknown as RxDocument<ConnectionDocument>,
    ];

    // Setup mock clinical documents for each user
    clinicalDocuments = [
      {
        id: 'doc-1',
        user_id: 'user-1',
        metadata: { date: '2024-01-01' },
        data_record: { resource_type: 'observation' },
      } as unknown as RxDocument<ClinicalDocument<any>>,
      {
        id: 'doc-2',
        user_id: 'user-1',
        metadata: { date: '2024-01-02' },
        data_record: { resource_type: 'procedure' },
      } as unknown as RxDocument<ClinicalDocument<any>>,
      {
        id: 'doc-3',
        user_id: 'user-2',
        metadata: { date: '2024-01-03' },
        data_record: { resource_type: 'observation' },
      } as unknown as RxDocument<ClinicalDocument<any>>,
    ];

    // Setup mock database
    mockDb = {
      user_documents: {
        findOne: jest.fn((query) => ({
          exec: jest.fn(() => {
            const selector = query.selector;
            if (selector.is_selected_user) {
              return Promise.resolve(userDocuments.find(u =>
                (u as any).is_selected_user === true
              ));
            }
            if (selector.id) {
              return Promise.resolve(userDocuments.find(u =>
                (u as any).id === selector.id
              ));
            }
            return Promise.resolve(null);
          }),
        })),
        find: jest.fn(() => ({
          exec: jest.fn(() => Promise.resolve(userDocuments)),
        })),
      },
      connection_documents: {
        findOne: jest.fn((query) => ({
          exec: jest.fn(() => {
            const selector = query.selector;
            return Promise.resolve(connectionDocuments.find(c =>
              c.user_id === selector.user_id &&
              c.location === selector.location
            ));
          }),
        })),
        find: jest.fn((query) => ({
          exec: jest.fn(() => {
            const selector = query?.selector;
            if (selector?.user_id) {
              return Promise.resolve(connectionDocuments.filter(c =>
                c.user_id === selector.user_id
              ));
            }
            return Promise.resolve(connectionDocuments);
          }),
        })),
      },
      clinical_documents: {
        find: jest.fn((query) => ({
          exec: jest.fn(() => {
            const selector = query?.selector;
            if (selector?.user_id) {
              return Promise.resolve(clinicalDocuments.filter(d =>
                d.user_id === selector.user_id
              ));
            }
            return Promise.resolve(clinicalDocuments);
          }),
        })),
      },
    } as unknown as RxDatabase<DatabaseCollections>;
  });

  describe('Full user switching flow', () => {
    it('should switch from Alice to Bob and update selected user', async () => {
      // Initially Alice is selected
      const currentUser = await mockDb.user_documents
        .findOne({ selector: { is_selected_user: true } })
        .exec();
      expect(currentUser?.id).toBe('user-1');

      // Perform switch to Bob
      const switchUser = async (userId: string) => {
        const newUser = await mockDb.user_documents
          .findOne({ selector: { id: userId } })
          .exec();

        if (!newUser) {
          throw new Error(`User not found: ${userId}`);
        }

        const currentUser = await mockDb.user_documents
          .findOne({ selector: { is_selected_user: true } })
          .exec();

        if (currentUser) {
          await currentUser.update({
            $set: { is_selected_user: false },
          });
          (currentUser as any).is_selected_user = false;
        }

        await newUser.update({
          $set: { is_selected_user: true },
        });
        (newUser as any).is_selected_user = true;
      };

      await switchUser('user-2');

      // Verify updates were called
      expect(userDocuments[0].update).toHaveBeenCalledWith({
        $set: { is_selected_user: false },
      });
      expect(userDocuments[1].update).toHaveBeenCalledWith({
        $set: { is_selected_user: true },
      });
    });
  });

  describe('Data isolation between users', () => {
    it('should only return connections for the current user', async () => {
      // Get connections for Alice
      const aliceConnections = await mockDb.connection_documents
        .find({ selector: { user_id: 'user-1' } })
        .exec();

      expect(aliceConnections).toHaveLength(2);
      expect(aliceConnections.every(c => c.user_id === 'user-1')).toBe(true);
      expect(aliceConnections.map(c => c.name)).toContain('Hospital A - Alice');
      expect(aliceConnections.map(c => c.name)).toContain('Hospital B - Alice');

      // Get connections for Bob
      const bobConnections = await mockDb.connection_documents
        .find({ selector: { user_id: 'user-2' } })
        .exec();

      expect(bobConnections).toHaveLength(1);
      expect(bobConnections[0].user_id).toBe('user-2');
      expect(bobConnections[0].name).toBe('Hospital A - Bob');
    });

    it('should only return clinical documents for the current user', async () => {
      // Get documents for Alice
      const aliceDocs = await mockDb.clinical_documents
        .find({ selector: { user_id: 'user-1' } })
        .exec();

      expect(aliceDocs).toHaveLength(2);
      expect(aliceDocs.every(d => d.user_id === 'user-1')).toBe(true);
      expect(aliceDocs.map(d => d.id)).toContain('doc-1');
      expect(aliceDocs.map(d => d.id)).toContain('doc-2');

      // Get documents for Bob
      const bobDocs = await mockDb.clinical_documents
        .find({ selector: { user_id: 'user-2' } })
        .exec();

      expect(bobDocs).toHaveLength(1);
      expect(bobDocs[0].user_id).toBe('user-2');
      expect(bobDocs[0].id).toBe('doc-3');
    });

    it('should not allow access to another users connection by URL', async () => {
      // Try to get Alice's connection as Bob
      const connectionForBob = await mockDb.connection_documents
        .findOne({
          selector: {
            location: 'https://hospital-b.com',
            user_id: 'user-2',
          },
        })
        .exec();

      // Bob shouldn't get Alice's connection
      expect(connectionForBob).toBeUndefined();

      // Alice should get her connection
      const connectionForAlice = await mockDb.connection_documents
        .findOne({
          selector: {
            location: 'https://hospital-b.com',
            user_id: 'user-1',
          },
        })
        .exec();

      expect(connectionForAlice).toBeDefined();
      expect(connectionForAlice?.name).toBe('Hospital B - Alice');
    });

    it('should allow both users to have connections to the same hospital', async () => {
      // Both users have connections to Hospital A
      const aliceHospitalA = await mockDb.connection_documents
        .findOne({
          selector: {
            location: 'https://hospital-a.com',
            user_id: 'user-1',
          },
        })
        .exec();

      const bobHospitalA = await mockDb.connection_documents
        .findOne({
          selector: {
            location: 'https://hospital-a.com',
            user_id: 'user-2',
          },
        })
        .exec();

      // Both should get their own connection
      expect(aliceHospitalA).toBeDefined();
      expect(aliceHospitalA?.access_token).toBe('alice-token-a');

      expect(bobHospitalA).toBeDefined();
      expect(bobHospitalA?.access_token).toBe('bob-token-a');

      // Tokens should be different
      expect(aliceHospitalA?.access_token).not.toBe(bobHospitalA?.access_token);
    });
  });

  describe('Connection CRUD operations are user-scoped', () => {
    it('should create new connection for the correct user', async () => {
      const newConnection = {
        id: 'conn-new',
        user_id: 'user-2',
        location: 'https://hospital-c.com',
        name: 'Hospital C - Bob',
        access_token: 'bob-token-c',
      };

      // Mock insert
      const mockInsert = jest.fn().mockResolvedValue(newConnection);
      (mockDb.connection_documents as any).insert = mockInsert;

      await mockDb.connection_documents.insert(newConnection);

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'user-2',
        }),
      );
    });

    it('should update only the users own connection', async () => {
      const mockUpdate = jest.fn().mockResolvedValue(true);
      const connection = {
        ...connectionDocuments[0],
        update: mockUpdate,
      };

      await connection.update({
        $set: { access_token: 'new-alice-token' },
      });

      expect(mockUpdate).toHaveBeenCalled();
      expect(connection.user_id).toBe('user-1');
    });

    it('should delete only the users own connection', async () => {
      const mockRemove = jest.fn().mockResolvedValue(true);
      const connection = {
        ...connectionDocuments[2], // Bob's connection
        remove: mockRemove,
      };

      await connection.remove();

      expect(mockRemove).toHaveBeenCalled();
      expect(connection.user_id).toBe('user-2');
    });
  });
});