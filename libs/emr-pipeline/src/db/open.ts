import { DatabaseSync } from 'node:sqlite';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { Kysely } from 'kysely';
import { nodeSqliteDialect } from '@mere/tenant-db';
import type { WarehouseDatabase } from './warehouse-schema';

const WAREHOUSE_FILE = path.join(__dirname, 'sql', 'warehouse.sql');
const STAGING_FILE = path.join(__dirname, 'sql', 'staging.sql');

/** An open handle to the warehouse. */
export type Warehouse = Kysely<WarehouseDatabase>;

/** Reads the warehouse schema version, which is zero on a brand-new file. */
function currentVersion(db: DatabaseSync): number {
  const row = db.prepare('PRAGMA user_version').get() as
    | { user_version: number }
    | undefined;
  return row?.user_version ?? 0;
}

/** Creates the durable schema on a brand-new file only. */
function initialize(db: DatabaseSync): void {
  if (currentVersion(db) !== 0) return;
  db.exec('BEGIN');
  try {
    db.exec(fs.readFileSync(WAREHOUSE_FILE, 'utf8'));
    db.exec('PRAGMA user_version = 1');
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

/** Drops and recreates the staging tables for transform to refill. */
function resetStagingTables(db: DatabaseSync): void {
  db.exec(fs.readFileSync(STAGING_FILE, 'utf8'));
}

/** True when every named table exists. */
function hasTables(db: DatabaseSync, names: string[]): boolean {
  const row = db
    .prepare(
      `SELECT COUNT(*) AS n FROM sqlite_master
       WHERE type = 'table' AND name IN (${names.map(() => '?').join(', ')})`,
    )
    .get(...names) as { n: number } | undefined;
  return row?.n === names.length;
}

/** True when all three staging tables exist. */
function hasStagingTables(db: DatabaseSync): boolean {
  return hasTables(db, [
    'tenant_names',
    'tenant_listings',
    'url_smart_security',
  ]);
}

/** True when every durable table exists. */
function hasCurrentWarehouseTables(db: DatabaseSync): boolean {
  return hasTables(db, [
    'capability_downloads',
    'directory_fetches',
    'fetch_runs',
    'publications',
    'directory_counts',
    'vendor_tenant_directory_snapshots',
  ]);
}

/**
 * Opens the warehouse at `dbPath`, creating the schema on first use and
 * recreating missing staging tables. A file without the warehouse tables is
 * refused.
 */
export function openWarehouse(dbPath: string): Warehouse {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new DatabaseSync(dbPath);
  try {
    // Configure waiting before any pragma that may need a lock.
    db.exec('PRAGMA busy_timeout = 5000');
    db.exec('PRAGMA journal_mode = WAL');
    initialize(db);
    if (!hasCurrentWarehouseTables(db)) {
      throw new Error(
        `Warehouse ${dbPath} is missing warehouse tables; delete it and rebuild`,
      );
    }
    if (!hasStagingTables(db)) {
      resetStagingTables(db);
    }
    return new Kysely<WarehouseDatabase>({ dialect: nodeSqliteDialect(db) });
  } catch (error) {
    db.close();
    throw error;
  }
}
