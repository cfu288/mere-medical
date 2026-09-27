import { RxDatabase } from 'rxdb';
import { DatabaseCollections } from './DatabaseCollections';
import {
  handleJSONDataImport,
  removeUnknownCollectionsFromDump,
} from './RxDbProvider';
import {
  createTestDatabase,
  cleanupTestDatabase,
} from '../../test-utils/createTestDatabase';
import demoData from '../../assets/demo.json';

function withLegacyCollection() {
  const dump = JSON.parse(JSON.stringify(demoData));
  dump.collections.push({
    name: 'uspstf_recommendation_documents',
    schemaHash: '9c2ct5',
    docs: [],
  });
  return dump;
}

describe('removeUnknownCollectionsFromDump', () => {
  it('drops collections that are no longer part of the database', () => {
    const result = removeUnknownCollectionsFromDump(withLegacyCollection());
    const names = result.collections.map((col) => col.name);

    expect(names).not.toContain('uspstf_recommendation_documents');
    expect(names).toEqual(demoData.collections.map((col) => col.name));
  });
});

describe('handleJSONDataImport', () => {
  let db: RxDatabase<DatabaseCollections>;

  beforeEach(async () => {
    db = await createTestDatabase();
  });

  afterEach(async () => {
    await cleanupTestDatabase(db);
  });

  it('imports backups that contain removed collections', async () => {
    await expect(
      handleJSONDataImport(JSON.stringify(withLegacyCollection()), db),
    ).resolves.toMatch(/successfully imported/);

    const user = await db.user_documents.findOne().exec();
    expect(user).toBeTruthy();
  });
});
