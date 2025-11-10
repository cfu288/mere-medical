import { RxDatabase } from 'rxdb';
import { DatabaseCollections } from '../components/providers/DatabaseCollections';
import {
  createTestDatabase,
  seedTestDatabase,
  cleanupTestDatabase,
} from './createTestDatabase';

describe('seedTestDatabase', () => {
  let db: RxDatabase<DatabaseCollections>;

  beforeEach(async () => {
    db = await createTestDatabase();
  });

  afterEach(async () => {
    await cleanupTestDatabase(db);
  });

  it('ensures demo.json schema matches current expected schema on import', async () => {
    await seedTestDatabase(db);
  });

  it('all imported documents are queryable', async () => {
    await seedTestDatabase(db);

    const user = await db.user_documents.findOne().exec();
    expect(user).toBeTruthy();
    expect(user?.get('id')).toBeTruthy();

    const connection = await db.connection_documents.findOne().exec();
    expect(connection).toBeTruthy();
    expect(connection?.get('id')).toBeTruthy();
    expect(connection?.get('user_id')).toBeTruthy();

    const clinicalDoc = await db.clinical_documents.findOne().exec();
    expect(clinicalDoc).toBeTruthy();
    expect(clinicalDoc?.get('id')).toBeTruthy();
    expect(clinicalDoc?.get('user_id')).toBeTruthy();

    const userPref = await db.user_preferences.findOne().exec();
    expect(userPref).toBeTruthy();
    expect(userPref?.get('user_id')).toBeTruthy();

    const summaryPref = await db.summary_page_preferences.findOne().exec();
    expect(summaryPref).toBeTruthy();
    expect(summaryPref?.get('user_id')).toBeTruthy();
  });

  it('imported documents conform to current schema structure', async () => {
    await seedTestDatabase(db);

    const user = await db.user_documents.findOne().exec();
    const userData = user?.toJSON();
    expect(userData).toHaveProperty('id');
    expect(userData).toHaveProperty('is_default_user');
    expect(userData).toHaveProperty('is_selected_user');

    const connection = await db.connection_documents.findOne().exec();
    const connectionData = connection?.toJSON();
    expect(connectionData).toHaveProperty('id');
    expect(connectionData).toHaveProperty('user_id');
    expect(connectionData).toHaveProperty('name');
    expect(connectionData).toHaveProperty('location');

    const clinicalDoc = await db.clinical_documents.findOne().exec();
    const clinicalData = clinicalDoc?.toJSON();
    expect(clinicalData).toHaveProperty('id');
    expect(clinicalData).toHaveProperty('user_id');
    expect(clinicalData).toHaveProperty('connection_record_id');
    expect(clinicalData).toHaveProperty('data_record');
    expect(clinicalData?.data_record).toHaveProperty('resource_type');
  });
});
