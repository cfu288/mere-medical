import {
  addRxPlugin,
  createRxDatabase,
  RxDatabase,
} from 'rxdb';
import { RxDBUpdatePlugin } from 'rxdb/plugins/update';
import { RxDBMigrationPlugin } from 'rxdb/plugins/migration';
import { RxDBJsonDumpPlugin } from 'rxdb/plugins/json-dump';
import { RxDBQueryBuilderPlugin } from 'rxdb/plugins/query-builder';
import { getRxStorageMemory } from 'rxdb/plugins/memory';
import { DatabaseCollections } from '../components/providers/DatabaseCollections';
import { databaseCollections } from '../components/providers/RxDbProvider';

// Add required plugins for testing
addRxPlugin(RxDBUpdatePlugin);
addRxPlugin(RxDBMigrationPlugin);
addRxPlugin(RxDBJsonDumpPlugin);
addRxPlugin(RxDBQueryBuilderPlugin);

/**
 * Creates an in-memory RxDB database for testing purposes.
 * Each test gets a unique database instance that runs entirely in memory.
 */
export async function createTestDatabase(): Promise<RxDatabase<DatabaseCollections>> {
  // Create a unique database name for each test to ensure isolation
  const dbName = `test-db-${Date.now()}-${Math.random().toString(36).substring(7)}`;

  const db = await createRxDatabase<DatabaseCollections>({
    name: dbName,
    storage: getRxStorageMemory(),
    multiInstance: false, // Tests don't need multi-instance support
    ignoreDuplicate: true,
  });

  await db.addCollections<DatabaseCollections>(databaseCollections);

  return db;
}

/**
 * Seeds the test database with demo data from the demo.json file.
 * Useful for tests that need realistic data.
 */
export async function seedTestDatabase(
  db: RxDatabase<DatabaseCollections>,
  data?: any
): Promise<void> {
  if (data) {
    await db.importJSON(data);
  } else {
    // Import default demo data
    const demoData = await import('../assets/demo.json');
    await db.importJSON(demoData as any);
  }
}

/**
 * Cleans up and destroys the test database.
 * Should be called in afterEach() to prevent memory leaks.
 */
export async function cleanupTestDatabase(
  db: RxDatabase<DatabaseCollections>
): Promise<void> {
  await db.destroy();
}