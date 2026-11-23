import { RxDatabase } from 'rxdb';
import {
  cleanupTestDatabase,
  createTestDatabase,
} from '../../test-utils/createTestDatabase';
import { DatabaseCollections } from './DatabaseCollections';

describe('RxDBRerunFailedQueryPlugin', () => {
  let db: RxDatabase<DatabaseCollections>;

  beforeEach(async () => {
    db = await createTestDatabase();
    await db.user_documents.insert({ id: 'user-1' });
  });

  afterEach(async () => {
    await cleanupTestDatabase(db);
  });

  it('reads the database again when the same query failed before', async () => {
    const find = () => db.user_documents.find({ selector: {} }).exec();
    jest
      .spyOn(db.user_documents.storageInstance, 'query')
      .mockRejectedValueOnce(new Error('read failed'));

    await expect(find()).rejects.toThrow('read failed');

    expect(await find()).toHaveLength(1);
  });
});
