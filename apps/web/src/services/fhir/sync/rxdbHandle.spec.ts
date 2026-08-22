import { RxDatabase } from 'rxdb';
import { DatabaseCollections } from '../../../app/providers/DatabaseCollections';
import {
  createTestDatabase,
  cleanupTestDatabase,
} from '../../../test-utils/createTestDatabase';
import { createEpicConnection } from '../../../test-utils/connectionTestData';

describe('rxdb document handle staleness', () => {
  let db: RxDatabase<DatabaseCollections>;

  beforeEach(async () => {
    db = await createTestDatabase();
  });

  afterEach(async () => {
    await cleanupTestDatabase(db);
  });

  it('shows an update made through one handle to a separately fetched handle', async () => {
    const conn = createEpicConnection({ access_token: 'stale-token' });
    await db.connection_documents.insert(conn);

    const handleA = await db.connection_documents
      .findOne({ selector: { id: conn.id } })
      .exec();
    const handleB = await db.connection_documents
      .findOne({ selector: { id: conn.id } })
      .exec();

    await handleB?.update({ $set: { access_token: 'fresh-token' } });

    expect(handleA?.toMutableJSON().access_token).toBe('fresh-token');
  });
});
