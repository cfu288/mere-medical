import { RxDatabase } from 'rxdb';
import { DatabaseCollections } from '../app/providers/DatabaseCollections';
import {
  cleanupTestDatabase,
  createTestDatabase,
} from '../test-utils/createTestDatabase';
import {
  findInstanceConfig,
  saveInstanceConfig,
} from './InstanceConfigRepository';

describe('InstanceConfigRepository', () => {
  let db: RxDatabase<DatabaseCollections>;

  beforeEach(async () => {
    db = await createTestDatabase();
    jest.spyOn(Date, 'now').mockReturnValue(1700000000000);
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    await cleanupTestDatabase(db);
  });

  it('returns null before any config is saved', async () => {
    expect(await findInstanceConfig(db)).toBeNull();
  });

  it('returns the saved config with the time it was saved', async () => {
    await saveInstanceConfig(db, {
      EPIC_CLIENT_ID: 'epic-client',
      HEALOW_CONFIDENTIAL_MODE: true,
    });

    expect(await findInstanceConfig(db)).toEqual({
      id: 'instance_config',
      EPIC_CLIENT_ID: 'epic-client',
      HEALOW_CONFIDENTIAL_MODE: true,
      updated_at: 1700000000000,
    });
  });

  it('replaces the config saved before', async () => {
    await saveInstanceConfig(db, { EPIC_CLIENT_ID: 'old-client' });

    await saveInstanceConfig(db, { CERNER_CLIENT_ID: 'cerner-client' });

    expect(await findInstanceConfig(db)).toEqual({
      id: 'instance_config',
      CERNER_CLIENT_ID: 'cerner-client',
      updated_at: 1700000000000,
    });
  });
});
