import { RxDatabase } from 'rxdb';
import { DatabaseCollections } from '../components/providers/DatabaseCollections';
import {
  createTestDatabase,
  cleanupTestDatabase,
} from '../test-utils/createTestDatabase';
import {
  createTestConnection,
  createEpicConnection,
  createCernerConnection,
  createMultipleTestConnections,
  createExpiredConnection,
  createConnectionWithTimestamps,
} from '../test-utils/connectionTestData';
import * as connectionRepo from './ConnectionRepository';
import { firstValueFrom } from 'rxjs';

describe('ConnectionRepository', () => {
  let db: RxDatabase<DatabaseCollections>;

  beforeEach(async () => {
    db = await createTestDatabase();
  });

  afterEach(async () => {
    await cleanupTestDatabase(db);
  });

  describe('query functions', () => {
    describe('findConnectionById', () => {
      it('returns connection when found', async () => {
        const testConn = createTestConnection();
        await db.connection_documents.insert(testConn);

        const result = await connectionRepo.findConnectionById(
          db,
          testConn.user_id,
          testConn.id,
        );

        expect(result).toBeTruthy();
        expect(result?.id).toBe(testConn.id);
        expect(result?.name).toBe(testConn.name);
      });

      it('returns null when connection not found', async () => {
        const result = await connectionRepo.findConnectionById(
          db,
          'user-id',
          'non-existent-id',
        );
        expect(result).toBeNull();
      });

      it('enforces user isolation', async () => {
        const testConn = createTestConnection({ user_id: 'userA' });
        await db.connection_documents.insert(testConn);

        await expect(
          connectionRepo.findConnectionById(db, 'userB', testConn.id),
        ).rejects.toThrow('Access denied');
      });
    });

    describe('findConnectionByUrl', () => {
      it('returns connection when found by URL', async () => {
        const testConn = createTestConnection({
          location: 'https://unique-hospital.com/fhir',
        });
        await db.connection_documents.insert(testConn);

        const result = await connectionRepo.findConnectionByUrl(
          db,
          testConn.user_id,
          'https://unique-hospital.com/fhir',
        );

        expect(result).toBeTruthy();
        expect(result?.id).toBe(testConn.id);
        expect(result?.location).toBe('https://unique-hospital.com/fhir');
      });

      it('returns null when URL not found', async () => {
        const result = await connectionRepo.findConnectionByUrl(
          db,
          'user-id',
          'https://nonexistent.com/fhir',
        );
        expect(result).toBeNull();
      });

      it('enforces user isolation for URL queries', async () => {
        const testConn = createTestConnection({
          user_id: 'userA',
          location: 'https://shared-hospital.com/fhir',
        });
        await db.connection_documents.insert(testConn);

        const result = await connectionRepo.findConnectionByUrl(
          db,
          'userB',
          'https://shared-hospital.com/fhir',
        );
        expect(result).toBeNull();
      });

      it('allows same URL for different users', async () => {
        const connA = createTestConnection({
          user_id: 'userA',
          location: 'https://hospital.com/fhir',
        });
        const connB = createTestConnection({
          user_id: 'userB',
          location: 'https://hospital.com/fhir',
        });
        await db.connection_documents.insert(connA);
        await db.connection_documents.insert(connB);

        const resultA = await connectionRepo.findConnectionByUrl(
          db,
          'userA',
          'https://hospital.com/fhir',
        );
        const resultB = await connectionRepo.findConnectionByUrl(
          db,
          'userB',
          'https://hospital.com/fhir',
        );

        expect(resultA?.id).toBe(connA.id);
        expect(resultB?.id).toBe(connB.id);
      });
    });

    describe('findConnectionsByIds', () => {
      it('returns multiple connections by IDs', async () => {
        const conns = createMultipleTestConnections(3);
        for (const conn of conns) {
          await db.connection_documents.insert(conn);
        }

        const ids = [conns[0].id, conns[2].id];
        const result = await connectionRepo.findConnectionsByIds(
          db,
          conns[0].user_id,
          ids,
        );

        expect(result).toHaveLength(2);
        expect(result.map((c) => c.id).sort()).toEqual(ids.sort());
      });

      it('returns empty array when no IDs match', async () => {
        const result = await connectionRepo.findConnectionsByIds(
          db,
          'user-id',
          ['id1', 'id2'],
        );
        expect(result).toEqual([]);
      });

      it('enforces user isolation for bulk queries', async () => {
        const connA = createTestConnection({ user_id: 'userA' });
        const connB = createTestConnection({ user_id: 'userB' });
        await db.connection_documents.insert(connA);
        await db.connection_documents.insert(connB);

        const result = await connectionRepo.findConnectionsByIds(db, 'userA', [
          connA.id,
          connB.id,
        ]);

        expect(result).toHaveLength(1);
        expect(result[0].id).toBe(connA.id);
      });
    });

    describe('findAllConnections', () => {
      it('returns all connections for a user', async () => {
        const conns = createMultipleTestConnections(3, 'userA');
        for (const conn of conns) {
          await db.connection_documents.insert(conn);
        }

        const result = await connectionRepo.findAllConnections(db, 'userA');

        expect(result).toHaveLength(3);
      });

      it('returns empty array when user has no connections', async () => {
        const result = await connectionRepo.findAllConnections(
          db,
          'user-with-no-connections',
        );
        expect(result).toEqual([]);
      });

      it('only returns connections for specified user', async () => {
        const connsA = createMultipleTestConnections(2, 'userA');
        const connsB = createMultipleTestConnections(2, 'userB');
        for (const conn of [...connsA, ...connsB]) {
          await db.connection_documents.insert(conn);
        }

        const result = await connectionRepo.findAllConnections(db, 'userA');

        expect(result).toHaveLength(2);
        expect(result.every((c) => c.user_id === 'userA')).toBe(true);
      });
    });

    describe('findConnectionWithDoc', () => {
      it('returns both plain object and RxDocument', async () => {
        const testConn = createTestConnection();
        await db.connection_documents.insert(testConn);

        const result = await connectionRepo.findConnectionWithDoc(
          db,
          testConn.user_id,
          testConn.id,
        );

        expect(result.connection).toBeTruthy();
        expect(result.connection?.id).toBe(testConn.id);
        expect(result.rawConnection).toBeTruthy();
        expect(typeof result.rawConnection?.update).toBe('function');
      });

      it('returns nulls when connection not found', async () => {
        const result = await connectionRepo.findConnectionWithDoc(
          db,
          'user-id',
          'non-existent',
        );

        expect(result.connection).toBeNull();
        expect(result.rawConnection).toBeNull();
      });

      it('enforces user isolation', async () => {
        const testConn = createTestConnection({ user_id: 'userA' });
        await db.connection_documents.insert(testConn);

        await expect(
          connectionRepo.findConnectionWithDoc(db, 'userB', testConn.id),
        ).rejects.toThrow('Access denied');
      });
    });

    describe('findConnectionsWithDocsByIds', () => {
      it('returns multiple connections with RxDocuments', async () => {
        const conn1 = createTestConnection({ name: 'Connection 1' });
        const conn2 = createTestConnection({ name: 'Connection 2' });
        await db.connection_documents.insert(conn1);
        await db.connection_documents.insert(conn2);

        const results = await connectionRepo.findConnectionsWithDocsByIds(
          db,
          conn1.user_id,
          [conn1.id, conn2.id],
        );

        expect(results).toHaveLength(2);

        const ids = results.map((r) => r.connection.id);
        expect(ids).toContain(conn1.id);
        expect(ids).toContain(conn2.id);

        results.forEach((result) => {
          expect(result.rawConnection).toBeTruthy();
          expect(typeof result.rawConnection.update).toBe('function');
        });
      });

      it('returns empty array when no IDs match', async () => {
        const results = await connectionRepo.findConnectionsWithDocsByIds(
          db,
          'user-id',
          ['non-existent-1', 'non-existent-2'],
        );

        expect(results).toHaveLength(0);
      });

      it('enforces user isolation for bulk queries', async () => {
        const connA = createTestConnection({ user_id: 'userA' });
        const connB = createTestConnection({ user_id: 'userB' });
        await db.connection_documents.insert(connA);
        await db.connection_documents.insert(connB);

        const results = await connectionRepo.findConnectionsWithDocsByIds(
          db,
          'userA',
          [connA.id, connB.id],
        );

        expect(results).toHaveLength(1);
        expect(results[0].connection.id).toBe(connA.id);
      });
    });
  });

  describe('reactive functions', () => {
    describe('watchAllConnections', () => {
      it('emits RxDocuments when connections change', async () => {
        const testConn = createTestConnection();
        await db.connection_documents.insert(testConn);

        const observable = connectionRepo.watchAllConnections(
          db,
          testConn.user_id,
        );
        const firstValue = await firstValueFrom(observable);

        expect(firstValue).toHaveLength(1);
        expect(typeof firstValue[0].update).toBe('function');
        expect(firstValue[0].get('id')).toBe(testConn.id);
      });

      it('emits updates when new connections are added', async () => {
        const userId = 'test-user';
        const observable = connectionRepo.watchAllConnections(db, userId);
        const values: any[] = [];
        const subscription = observable.subscribe((value) =>
          values.push(value),
        );

        await db.connection_documents.insert(
          createTestConnection({ user_id: userId }),
        );
        await new Promise((resolve) => setTimeout(resolve, 100));

        await db.connection_documents.insert(
          createTestConnection({ user_id: userId }),
        );
        await new Promise((resolve) => setTimeout(resolve, 100));

        subscription.unsubscribe();

        expect(values.length).toBeGreaterThan(1);
        expect(values[values.length - 1]).toHaveLength(2);
      });

      it('only emits connections for specified user', async () => {
        const observable = connectionRepo.watchAllConnections(db, 'userA');
        const values: any[] = [];
        const subscription = observable.subscribe((value) =>
          values.push(value),
        );

        await db.connection_documents.insert(
          createTestConnection({ user_id: 'userA' }),
        );
        await db.connection_documents.insert(
          createTestConnection({ user_id: 'userB' }),
        );
        await new Promise((resolve) => setTimeout(resolve, 100));

        subscription.unsubscribe();

        const lastValue = values[values.length - 1];
        expect(lastValue).toHaveLength(1);
        expect(lastValue[0].get('user_id')).toBe('userA');
      });
    });

    describe('watchConnectionCount', () => {
      it('emits count when connections change', async () => {
        const userId = 'test-user';
        const observable = connectionRepo.watchConnectionCount(db, userId);
        const values: number[] = [];
        const subscription = observable.subscribe((value) =>
          values.push(value),
        );

        await db.connection_documents.insert(
          createTestConnection({ user_id: userId }),
        );
        await new Promise((resolve) => setTimeout(resolve, 100));

        await db.connection_documents.insert(
          createTestConnection({ user_id: userId }),
        );
        await new Promise((resolve) => setTimeout(resolve, 100));

        subscription.unsubscribe();

        expect(values[values.length - 1]).toBe(2);
      });
    });
  });

  describe('command functions', () => {
    describe('createConnection', () => {
      it('creates a new connection', async () => {
        const connectionData = createTestConnection();

        const result = await connectionRepo.createConnection(
          db,
          connectionData,
        );

        expect(result).toBeTruthy();
        expect(result.get('id')).toBe(connectionData.id);

        const dbConn = await db.connection_documents
          .findOne({ selector: { id: connectionData.id } })
          .exec();
        expect(dbConn).toBeTruthy();
      });

      it('creates Epic connection with provider-specific fields', async () => {
        const epicConn = createEpicConnection();

        await connectionRepo.createConnection(db, epicConn);

        const dbConn = await db.connection_documents
          .findOne({ selector: { id: epicConn.id } })
          .exec();
        expect(dbConn?.get('source')).toBe('epic');
        expect(dbConn?.get('client_id')).toBe(epicConn.client_id);
        expect(dbConn?.get('patient')).toBe(epicConn.patient);
      });

      it('creates Cerner connection with id_token', async () => {
        const cernerConn = createCernerConnection();

        await connectionRepo.createConnection(db, cernerConn);

        const dbConn = await db.connection_documents
          .findOne({ selector: { id: cernerConn.id } })
          .exec();
        expect(dbConn?.get('source')).toBe('cerner');
        expect(dbConn?.get('id_token')).toBe(cernerConn.id_token);
      });

      it('throws error when user_id is missing', async () => {
        const connectionData = createTestConnection();
        delete (connectionData as any).user_id;

        await expect(
          connectionRepo.createConnection(db, connectionData),
        ).rejects.toThrow('Cannot create connection without user_id');
      });
    });

    describe('updateConnection', () => {
      it('updates existing connection', async () => {
        const testConn = createTestConnection({ name: 'Original Name' });
        await db.connection_documents.insert(testConn);

        await connectionRepo.updateConnection(
          db,
          testConn.user_id,
          testConn.id,
          {
            name: 'Updated Name',
          },
        );

        const updated = await db.connection_documents
          .findOne({ selector: { id: testConn.id } })
          .exec();
        expect(updated?.get('name')).toBe('Updated Name');
      });

      it('throws error when connection not found', async () => {
        await expect(
          connectionRepo.updateConnection(db, 'user-id', 'non-existent', {
            name: 'Test',
          }),
        ).rejects.toThrow('Connection not found: non-existent');
      });

      it('enforces user isolation on updates', async () => {
        const testConn = createTestConnection({ user_id: 'userA' });
        await db.connection_documents.insert(testConn);

        await expect(
          connectionRepo.updateConnection(db, 'userB', testConn.id, {
            name: 'Hacked',
          }),
        ).rejects.toThrow('Access denied');
      });
    });

    describe('updateConnectionToken', () => {
      it('updates token fields', async () => {
        const testConn = createTestConnection();
        await db.connection_documents.insert(testConn);

        const newTokenData = {
          access_token: 'new-token',
          expires_at: Date.now() + 7200000,
          scope: 'patient/*.read launch',
        };

        await connectionRepo.updateConnectionToken(
          db,
          testConn.user_id,
          testConn.id,
          newTokenData,
        );

        const updated = await db.connection_documents
          .findOne({ selector: { id: testConn.id } })
          .exec();
        expect(updated?.get('access_token')).toBe('new-token');
        expect(updated?.get('expires_at')).toBe(newTokenData.expires_at);
        expect(updated?.get('scope')).toBe('patient/*.read launch');
      });

      it('updates refresh_token when provided', async () => {
        const testConn = createCernerConnection();
        await db.connection_documents.insert(testConn);

        await connectionRepo.updateConnectionToken(
          db,
          testConn.user_id,
          testConn.id,
          {
            access_token: 'new-token',
            refresh_token: 'new-refresh-token',
          },
        );

        const updated = await db.connection_documents
          .findOne({ selector: { id: testConn.id } })
          .exec();
        expect(updated?.get('refresh_token')).toBe('new-refresh-token');
      });
    });

    describe('updateConnectionTimestamp', () => {
      it('updates timestamp fields', async () => {
        const testConn = createTestConnection();
        await db.connection_documents.insert(testConn);

        const now = new Date().toISOString();
        await connectionRepo.updateConnectionTimestamp(
          db,
          testConn.user_id,
          testConn.id,
          {
            last_refreshed: now,
            last_sync_attempt: now,
            last_sync_was_error: false,
          },
        );

        const updated = await db.connection_documents
          .findOne({ selector: { id: testConn.id } })
          .exec();
        expect(updated?.get('last_refreshed')).toBe(now);
        expect(updated?.get('last_sync_was_error')).toBe(false);
      });
    });

    describe('upsertConnection', () => {
      it('creates connection if it does not exist', async () => {
        const connectionData = createTestConnection();

        await connectionRepo.upsertConnection(
          db,
          connectionData.user_id,
          connectionData,
        );

        const dbConn = await db.connection_documents
          .findOne({ selector: { id: connectionData.id } })
          .exec();
        expect(dbConn).toBeTruthy();
      });

      it('updates connection if it exists', async () => {
        const connectionData = createTestConnection({ name: 'Original' });
        await db.connection_documents.insert(connectionData);

        const updatedData = { ...connectionData, name: 'Updated' };
        await connectionRepo.upsertConnection(
          db,
          connectionData.user_id,
          updatedData,
        );

        const dbConn = await db.connection_documents
          .findOne({ selector: { id: connectionData.id } })
          .exec();
        expect(dbConn?.get('name')).toBe('Updated');
      });

      it('throws error when userId does not match connection user_id', async () => {
        const connectionData = createTestConnection({ user_id: 'userA' });

        await expect(
          connectionRepo.upsertConnection(db, 'userB', connectionData),
        ).rejects.toThrow('Cannot upsert connection for different user');
      });
    });

    describe('deleteConnection', () => {
      it('deletes existing connection', async () => {
        const testConn = createTestConnection();
        await db.connection_documents.insert(testConn);

        await connectionRepo.deleteConnection(
          db,
          testConn.user_id,
          testConn.id,
        );

        const deleted = await db.connection_documents
          .findOne({ selector: { id: testConn.id } })
          .exec();
        expect(deleted).toBeNull();
      });

      it('does nothing when connection not found', async () => {
        await expect(
          connectionRepo.deleteConnection(db, 'user-id', 'non-existent'),
        ).resolves.not.toThrow();
      });

      it('enforces user isolation on deletes', async () => {
        const testConn = createTestConnection({ user_id: 'userA' });
        await db.connection_documents.insert(testConn);

        await connectionRepo.deleteConnection(db, 'userB', testConn.id);

        const stillExists = await db.connection_documents
          .findOne({ selector: { id: testConn.id } })
          .exec();
        expect(stillExists).toBeTruthy();
      });
    });
  });

  describe('edge cases', () => {
    it('handles expired connections', async () => {
      const expiredConn = createExpiredConnection();
      await db.connection_documents.insert(expiredConn);

      const result = await connectionRepo.findConnectionById(
        db,
        expiredConn.user_id,
        expiredConn.id,
      );

      expect(result).toBeTruthy();
      expect(result?.expires_at).toBeLessThan(Date.now());
    });

    it('handles sequential updates correctly', async () => {
      const testConn = createTestConnection();
      await db.connection_documents.insert(testConn);

      await connectionRepo.updateConnection(db, testConn.user_id, testConn.id, {
        name: 'Update 1',
      });

      await connectionRepo.updateConnectionToken(
        db,
        testConn.user_id,
        testConn.id,
        {
          access_token: 'new-token',
        },
      );

      await connectionRepo.updateConnectionTimestamp(
        db,
        testConn.user_id,
        testConn.id,
        {
          last_sync_attempt: new Date().toISOString(),
        },
      );

      const final = await connectionRepo.findConnectionById(
        db,
        testConn.user_id,
        testConn.id,
      );
      expect(final?.name).toBe('Update 1');
      expect(final?.access_token).toBe('new-token');
      expect(final?.last_sync_attempt).toBeTruthy();
    });
  });
});
