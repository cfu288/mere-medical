import { RxDatabase } from 'rxdb';
import { DatabaseCollections } from '../app/providers/DatabaseCollections';
import {
  createTestDatabase,
  cleanupTestDatabase,
} from '../test-utils/createTestDatabase';
import { createTestConnection } from '../test-utils/connectionTestData';
import { createTestClinicalDocument } from '../test-utils/clinicalDocumentTestData';
import {
  connectionExists,
  deleteOrphanedDocuments,
  upsertDocumentsIfConnectionValid,
} from './ClinicalDocumentRepository';
import { ConnectionDeletedError } from '../shared/errors';

describe('ClinicalDocumentRepository', () => {
  let db: RxDatabase<DatabaseCollections>;

  beforeEach(async () => {
    db = await createTestDatabase();
  });

  afterEach(async () => {
    await cleanupTestDatabase(db);
  });

  describe('connectionExists', () => {
    it('returns true when connection exists for user', async () => {
      const connection = createTestConnection();
      await db.connection_documents.insert(connection);

      const result = await connectionExists(
        db,
        connection.user_id,
        connection.id,
      );

      expect(result).toBe(true);
    });

    it('returns false when connection does not exist', async () => {
      const result = await connectionExists(
        db,
        'test-user',
        'non-existent-connection',
      );

      expect(result).toBe(false);
    });

    it('returns false when connection exists for different user (isolation)', async () => {
      const connection = createTestConnection({ user_id: 'userA' });
      await db.connection_documents.insert(connection);

      const result = await connectionExists(db, 'userB', connection.id);

      expect(result).toBe(false);
    });

    it('returns false when connection id matches but user id differs', async () => {
      const connectionA = createTestConnection({
        id: 'shared-connection-id',
        user_id: 'userA',
      });
      await db.connection_documents.insert(connectionA);

      const resultA = await connectionExists(
        db,
        'userA',
        'shared-connection-id',
      );
      const resultB = await connectionExists(
        db,
        'userB',
        'shared-connection-id',
      );

      expect(resultA).toBe(true);
      expect(resultB).toBe(false);
    });
  });

  describe('deleteOrphanedDocuments', () => {
    it('removes documents with non-existent connection_record_id', async () => {
      const connection = createTestConnection();
      await db.connection_documents.insert(connection);

      const validDoc = createTestClinicalDocument({
        user_id: connection.user_id,
        connection_record_id: connection.id,
      });
      const orphanedDoc = createTestClinicalDocument({
        user_id: connection.user_id,
        connection_record_id: 'deleted-connection-id',
      });
      await db.clinical_documents.bulkInsert([validDoc, orphanedDoc]);

      const deletedCount = await deleteOrphanedDocuments(
        db,
        connection.user_id,
      );

      expect(deletedCount).toBe(1);

      const remainingDocs = await db.clinical_documents
        .find({ selector: { user_id: connection.user_id } })
        .exec();
      expect(remainingDocs).toHaveLength(1);
      expect(remainingDocs[0].get('connection_record_id')).toBe(connection.id);
    });

    it('keeps documents with valid connection_record_id', async () => {
      const connection = createTestConnection();
      await db.connection_documents.insert(connection);

      const validDoc1 = createTestClinicalDocument({
        user_id: connection.user_id,
        connection_record_id: connection.id,
      });
      const validDoc2 = createTestClinicalDocument({
        user_id: connection.user_id,
        connection_record_id: connection.id,
      });
      await db.clinical_documents.bulkInsert([validDoc1, validDoc2]);

      const deletedCount = await deleteOrphanedDocuments(
        db,
        connection.user_id,
      );

      expect(deletedCount).toBe(0);

      const remainingDocs = await db.clinical_documents
        .find({ selector: { user_id: connection.user_id } })
        .exec();
      expect(remainingDocs).toHaveLength(2);
    });

    it('returns count of deleted documents', async () => {
      const connection = createTestConnection();
      await db.connection_documents.insert(connection);

      const orphanedDocs = [
        createTestClinicalDocument({
          user_id: connection.user_id,
          connection_record_id: 'deleted-1',
        }),
        createTestClinicalDocument({
          user_id: connection.user_id,
          connection_record_id: 'deleted-2',
        }),
        createTestClinicalDocument({
          user_id: connection.user_id,
          connection_record_id: 'deleted-3',
        }),
      ];
      await db.clinical_documents.bulkInsert(orphanedDocs);

      const deletedCount = await deleteOrphanedDocuments(
        db,
        connection.user_id,
      );

      expect(deletedCount).toBe(3);
    });

    it('returns 0 when no orphaned documents exist', async () => {
      const connection = createTestConnection();
      await db.connection_documents.insert(connection);

      const validDoc = createTestClinicalDocument({
        user_id: connection.user_id,
        connection_record_id: connection.id,
      });
      await db.clinical_documents.insert(validDoc);

      const deletedCount = await deleteOrphanedDocuments(
        db,
        connection.user_id,
      );

      expect(deletedCount).toBe(0);
    });

    it('handles empty database gracefully', async () => {
      const deletedCount = await deleteOrphanedDocuments(db, 'any-user');

      expect(deletedCount).toBe(0);
    });

    it('only affects specified user documents (isolation)', async () => {
      const connectionA = createTestConnection({ user_id: 'userA' });
      const connectionB = createTestConnection({ user_id: 'userB' });
      await db.connection_documents.bulkInsert([connectionA, connectionB]);

      const orphanedDocA = createTestClinicalDocument({
        user_id: 'userA',
        connection_record_id: 'deleted-connection',
      });
      const validDocB = createTestClinicalDocument({
        user_id: 'userB',
        connection_record_id: connectionB.id,
      });
      const orphanedDocB = createTestClinicalDocument({
        user_id: 'userB',
        connection_record_id: 'deleted-connection-b',
      });
      await db.clinical_documents.bulkInsert([
        orphanedDocA,
        validDocB,
        orphanedDocB,
      ]);

      const deletedCount = await deleteOrphanedDocuments(db, 'userA');

      expect(deletedCount).toBe(1);

      const userBDocs = await db.clinical_documents
        .find({ selector: { user_id: 'userB' } })
        .exec();
      expect(userBDocs).toHaveLength(2);
    });
  });

  describe('upsertDocumentsIfConnectionValid', () => {
    it('upserts documents when connection exists', async () => {
      const connection = createTestConnection();
      await db.connection_documents.insert(connection);

      const documents = [
        createTestClinicalDocument({
          user_id: connection.user_id,
          connection_record_id: connection.id,
        }),
        createTestClinicalDocument({
          user_id: connection.user_id,
          connection_record_id: connection.id,
        }),
      ];

      await upsertDocumentsIfConnectionValid(
        db,
        connection.user_id,
        connection.id,
        documents,
      );

      const insertedDocs = await db.clinical_documents
        .find({ selector: { user_id: connection.user_id } })
        .exec();
      expect(insertedDocs).toHaveLength(2);
    });

    it('throws ConnectionDeletedError when connection does not exist', async () => {
      const documents = [
        createTestClinicalDocument({
          user_id: 'test-user',
          connection_record_id: 'non-existent-connection',
        }),
      ];

      await expect(
        upsertDocumentsIfConnectionValid(
          db,
          'test-user',
          'non-existent-connection',
          documents,
        ),
      ).rejects.toThrow(ConnectionDeletedError);
    });

    it('throws ConnectionDeletedError when connection is deleted before upsert', async () => {
      const connection = createTestConnection();
      await db.connection_documents.insert(connection);

      const documents = [
        createTestClinicalDocument({
          user_id: connection.user_id,
          connection_record_id: connection.id,
        }),
      ];

      await db.connection_documents
        .findOne({ selector: { id: connection.id } })
        .exec()
        .then((doc) => doc?.remove());

      await expect(
        upsertDocumentsIfConnectionValid(
          db,
          connection.user_id,
          connection.id,
          documents,
        ),
      ).rejects.toThrow(ConnectionDeletedError);
    });

    it('does not upsert any documents when connection is missing', async () => {
      const documents = [
        createTestClinicalDocument({
          user_id: 'test-user',
          connection_record_id: 'non-existent-connection',
        }),
      ];

      try {
        await upsertDocumentsIfConnectionValid(
          db,
          'test-user',
          'non-existent-connection',
          documents,
        );
      } catch {
        // Expected to throw
      }

      const insertedDocs = await db.clinical_documents
        .find({ selector: { user_id: 'test-user' } })
        .exec();
      expect(insertedDocs).toHaveLength(0);
    });
  });

  describe('race condition: connection deletion during sync', () => {
    it('cleans up documents when connection deleted after pre-check passes but before post-check', async () => {
      const connection = createTestConnection();
      await db.connection_documents.insert(connection);

      const documents = [
        createTestClinicalDocument({
          user_id: connection.user_id,
          connection_record_id: connection.id,
        }),
        createTestClinicalDocument({
          user_id: connection.user_id,
          connection_record_id: connection.id,
        }),
      ];

      const originalBulkUpsert = db.clinical_documents.bulkUpsert.bind(
        db.clinical_documents,
      );
      db.clinical_documents.bulkUpsert = async (docs: any) => {
        const result = await originalBulkUpsert(docs);
        await db.connection_documents
          .findOne({ selector: { id: connection.id } })
          .exec()
          .then((doc) => doc?.remove());
        return result;
      };

      await expect(
        upsertDocumentsIfConnectionValid(
          db,
          connection.user_id,
          connection.id,
          documents,
        ),
      ).rejects.toThrow(ConnectionDeletedError);

      const orphanedDocs = await db.clinical_documents
        .find({ selector: { connection_record_id: connection.id } })
        .exec();
      expect(orphanedDocs).toHaveLength(0);
    });

    it('leaves no orphans when connection is deleted mid-sync with multiple documents', async () => {
      const connection = createTestConnection();
      await db.connection_documents.insert(connection);

      const documents = Array.from({ length: 10 }, () =>
        createTestClinicalDocument({
          user_id: connection.user_id,
          connection_record_id: connection.id,
        }),
      );

      const originalBulkUpsert = db.clinical_documents.bulkUpsert.bind(
        db.clinical_documents,
      );
      db.clinical_documents.bulkUpsert = async (docs: any) => {
        const result = await originalBulkUpsert(docs);
        await db.connection_documents
          .findOne({ selector: { id: connection.id } })
          .exec()
          .then((doc) => doc?.remove());
        return result;
      };

      await expect(
        upsertDocumentsIfConnectionValid(
          db,
          connection.user_id,
          connection.id,
          documents,
        ),
      ).rejects.toThrow(ConnectionDeletedError);

      const orphanedDocs = await db.clinical_documents
        .find({ selector: { connection_record_id: connection.id } })
        .exec();
      expect(orphanedDocs).toHaveLength(0);
    });

    it('does not affect other users documents during cleanup', async () => {
      const connectionA = createTestConnection({ user_id: 'userA' });
      const connectionB = createTestConnection({ user_id: 'userB' });
      await db.connection_documents.bulkInsert([connectionA, connectionB]);

      const userBDoc = createTestClinicalDocument({
        user_id: 'userB',
        connection_record_id: connectionB.id,
      });
      await db.clinical_documents.insert(userBDoc);

      const userADocs = [
        createTestClinicalDocument({
          user_id: 'userA',
          connection_record_id: connectionA.id,
        }),
      ];

      const originalBulkUpsert = db.clinical_documents.bulkUpsert.bind(
        db.clinical_documents,
      );
      db.clinical_documents.bulkUpsert = async (docs: any) => {
        const result = await originalBulkUpsert(docs);
        await db.connection_documents
          .findOne({ selector: { id: connectionA.id } })
          .exec()
          .then((doc) => doc?.remove());
        return result;
      };

      await expect(
        upsertDocumentsIfConnectionValid(
          db,
          connectionA.user_id,
          connectionA.id,
          userADocs,
        ),
      ).rejects.toThrow(ConnectionDeletedError);

      const userBDocs = await db.clinical_documents
        .find({ selector: { user_id: 'userB' } })
        .exec();
      expect(userBDocs).toHaveLength(1);
      expect(userBDocs[0].get('id')).toBe(userBDoc.id);
    });

    it('deleteOrphanedDocuments serves as safety net for any orphans that slip through', async () => {
      const connection = createTestConnection();

      const orphanedDocs = [
        createTestClinicalDocument({
          user_id: connection.user_id,
          connection_record_id: connection.id,
        }),
        createTestClinicalDocument({
          user_id: connection.user_id,
          connection_record_id: connection.id,
        }),
        createTestClinicalDocument({
          user_id: connection.user_id,
          connection_record_id: 'another-deleted-connection',
        }),
      ];
      await db.clinical_documents.bulkInsert(orphanedDocs);

      const docsBefore = await db.clinical_documents
        .find({ selector: { user_id: connection.user_id } })
        .exec();
      expect(docsBefore).toHaveLength(3);

      const deletedCount = await deleteOrphanedDocuments(
        db,
        connection.user_id,
      );

      expect(deletedCount).toBe(3);

      const docsAfter = await db.clinical_documents
        .find({ selector: { user_id: connection.user_id } })
        .exec();
      expect(docsAfter).toHaveLength(0);
    });

    it('handles rapid successive upsert attempts after connection deletion', async () => {
      const connection = createTestConnection();
      await db.connection_documents.insert(connection);

      await db.connection_documents
        .findOne({ selector: { id: connection.id } })
        .exec()
        .then((doc) => doc?.remove());

      const upsertAttempts = Array.from({ length: 5 }, () =>
        upsertDocumentsIfConnectionValid(
          db,
          connection.user_id,
          connection.id,
          [
            createTestClinicalDocument({
              user_id: connection.user_id,
              connection_record_id: connection.id,
            }),
          ],
        ).catch((e) => e),
      );

      const results = await Promise.all(upsertAttempts);

      results.forEach((result) => {
        expect(result).toBeInstanceOf(ConnectionDeletedError);
      });

      const orphanedDocs = await db.clinical_documents
        .find({ selector: { connection_record_id: connection.id } })
        .exec();
      expect(orphanedDocs).toHaveLength(0);
    });
  });
});
