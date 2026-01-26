import { RxDatabase } from 'rxdb';
import { DatabaseCollections } from '../../app/providers/DatabaseCollections';
import {
  createTestDatabase,
  cleanupTestDatabase,
} from '../../test-utils/createTestDatabase';
import {
  createTestConnection,
  createConnectionWithTimestamps,
} from '../../test-utils/connectionTestData';
import { createTestClinicalDocument } from '../../test-utils/clinicalDocumentTestData';
import * as connectionService from './ConnectionService';
import * as connectionRepo from '../../repositories/ConnectionRepository';
import { upsertDocumentsIfConnectionValid } from '../../repositories/ClinicalDocumentRepository';

describe('ConnectionService', () => {
  let db: RxDatabase<DatabaseCollections>;

  beforeEach(async () => {
    db = await createTestDatabase();
  });

  afterEach(async () => {
    await cleanupTestDatabase(db);
  });

  describe('sync error handling', () => {
    describe('recordSyncSuccess', () => {
      it('records sync success with coordinated timestamps', async () => {
        const testConn = createTestConnection();
        await db.connection_documents.insert(testConn);

        await connectionService.recordSyncSuccess(
          db,
          testConn.user_id,
          testConn.id,
        );

        const updated = await connectionRepo.findConnectionById(
          db,
          testConn.user_id,
          testConn.id,
        );

        expect(updated?.last_sync_was_error).toBe(false);
        expect(updated?.last_refreshed).toBeTruthy();
        expect(updated?.last_sync_attempt).toBeTruthy();
        expect(updated?.last_refreshed).toBe(updated?.last_sync_attempt);
      });

      it('clears previous error flag on success', async () => {
        const testConn = createConnectionWithTimestamps({
          last_sync_was_error: true,
          last_sync_attempt: '2024-01-01T00:00:00.000Z',
        });
        await db.connection_documents.insert(testConn);

        await connectionService.recordSyncSuccess(
          db,
          testConn.user_id,
          testConn.id,
        );

        const updated = await connectionRepo.findConnectionById(
          db,
          testConn.user_id,
          testConn.id,
        );

        expect(updated?.last_sync_was_error).toBe(false);
        expect(updated?.last_refreshed).not.toBe('2024-01-01T00:00:00.000Z');
        expect(updated?.last_sync_attempt).not.toBe('2024-01-01T00:00:00.000Z');
      });
    });

    describe('recordSyncError', () => {
      it('records sync error without updating last_refreshed', async () => {
        const testConn = createConnectionWithTimestamps({
          last_refreshed: '2024-01-01T00:00:00.000Z',
          last_sync_was_error: false,
        });
        await db.connection_documents.insert(testConn);

        await connectionService.recordSyncError(
          db,
          testConn.user_id,
          testConn.id,
        );

        const updated = await connectionRepo.findConnectionById(
          db,
          testConn.user_id,
          testConn.id,
        );

        expect(updated?.last_sync_was_error).toBe(true);
        expect(updated?.last_sync_attempt).toBeTruthy();
        expect(updated?.last_sync_attempt).not.toBe('2024-01-01T00:00:00.000Z');
        expect(updated?.last_refreshed).toBe('2024-01-01T00:00:00.000Z');
      });

      it('handles multiple sync failures in a row', async () => {
        const testConn = createTestConnection();
        await db.connection_documents.insert(testConn);

        await connectionService.recordSyncError(
          db,
          testConn.user_id,
          testConn.id,
        );

        const firstError = await connectionRepo.findConnectionById(
          db,
          testConn.user_id,
          testConn.id,
        );
        const firstAttemptTime = firstError?.last_sync_attempt;

        await new Promise((resolve) => setTimeout(resolve, 10));

        await connectionService.recordSyncError(
          db,
          testConn.user_id,
          testConn.id,
        );

        const secondError = await connectionRepo.findConnectionById(
          db,
          testConn.user_id,
          testConn.id,
        );

        expect(secondError?.last_sync_was_error).toBe(true);
        expect(secondError?.last_sync_attempt).not.toBe(firstAttemptTime);
      });
    });

    describe('clearSyncError', () => {
      it('clears error flag after successful authentication', async () => {
        const testConn = createConnectionWithTimestamps({
          last_sync_was_error: true,
          last_sync_attempt: '2024-01-01T00:00:00.000Z',
        });
        await db.connection_documents.insert(testConn);

        await connectionService.clearSyncError(
          db,
          testConn.user_id,
          testConn.id,
        );

        const updated = await connectionRepo.findConnectionById(
          db,
          testConn.user_id,
          testConn.id,
        );

        expect(updated?.last_sync_was_error).toBe(false);
        expect(updated?.last_sync_attempt).toBe('2024-01-01T00:00:00.000Z');
      });
    });

    describe('sync recording with deleted connection', () => {
      it('recordSyncSuccess does not throw when connection was deleted', async () => {
        const testConn = createTestConnection();
        await db.connection_documents.insert(testConn);

        await connectionRepo.deleteConnection(
          db,
          testConn.user_id,
          testConn.id,
        );

        await expect(
          connectionService.recordSyncSuccess(
            db,
            testConn.user_id,
            testConn.id,
          ),
        ).resolves.not.toThrow();
      });

      it('recordSyncError does not throw when connection was deleted', async () => {
        const testConn = createTestConnection();
        await db.connection_documents.insert(testConn);

        await connectionRepo.deleteConnection(
          db,
          testConn.user_id,
          testConn.id,
        );

        await expect(
          connectionService.recordSyncError(db, testConn.user_id, testConn.id),
        ).resolves.not.toThrow();
      });
    });
  });

  describe('deleteConnectionWithCascade race condition', () => {
    it('deleteConnectionWithCascade deletes connection first, preventing orphans from concurrent sync', async () => {
      const connection = createTestConnection();
      await db.connection_documents.insert(connection);

      const initialDocs = [
        createTestClinicalDocument({
          user_id: connection.user_id,
          connection_record_id: connection.id,
        }),
      ];
      await db.clinical_documents.bulkInsert(initialDocs);

      await connectionService.deleteConnectionWithCascade(
        db,
        connection.user_id,
        connection.id,
      );

      const docs = [
        createTestClinicalDocument({
          user_id: connection.user_id,
          connection_record_id: connection.id,
        }),
      ];
      await expect(
        upsertDocumentsIfConnectionValid(
          db,
          connection.user_id,
          connection.id,
          docs,
        ),
      ).rejects.toThrow();

      const orphanedDocs = await db.clinical_documents
        .find({ selector: { connection_record_id: connection.id } })
        .exec();

      expect(orphanedDocs).toHaveLength(0);
    });

    it('sync fails immediately when connection is deleted first', async () => {
      const connection = createTestConnection();
      await db.connection_documents.insert(connection);

      await connectionRepo.deleteConnection(
        db,
        connection.user_id,
        connection.id,
      );

      const docs = [
        createTestClinicalDocument({
          user_id: connection.user_id,
          connection_record_id: connection.id,
        }),
      ];

      await expect(
        upsertDocumentsIfConnectionValid(
          db,
          connection.user_id,
          connection.id,
          docs,
        ),
      ).rejects.toThrow();

      const orphanedDocs = await db.clinical_documents
        .find({ selector: { connection_record_id: connection.id } })
        .exec();
      expect(orphanedDocs).toHaveLength(0);
    });
  });
});
