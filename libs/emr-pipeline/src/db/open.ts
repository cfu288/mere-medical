import { DatabaseSync } from 'node:sqlite';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { getRow } from '@mere/tenant-db';

const WAREHOUSE_FILE = path.join(__dirname, 'sql', 'warehouse.sql');
const DERIVED_FILE = path.join(__dirname, 'sql', 'derived.sql');

function currentVersion(db: DatabaseSync): number {
  const row = getRow<{ user_version: number }>(
    db.prepare('PRAGMA user_version'),
  );
  return row?.user_version ?? 0;
}

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

function rebuildDerived(db: DatabaseSync): void {
  db.exec(fs.readFileSync(DERIVED_FILE, 'utf8'));
}

function hasTables(db: DatabaseSync, names: string[]): boolean {
  const row = getRow<{ n: number }>(
    db.prepare(
      `SELECT COUNT(*) AS n FROM sqlite_master
       WHERE type = 'table' AND name IN (${names.map(() => '?').join(', ')})`,
    ),
    names,
  );
  return row?.n === names.length;
}

function hasDerivedTables(db: DatabaseSync): boolean {
  return hasTables(db, [
    'tenant_directory_entries',
    'tenant_urls',
    'tenant_capabilities',
  ]);
}

function hasCurrentWarehouseTables(db: DatabaseSync): boolean {
  return hasTables(db, [
    'capability_downloads',
    'directory_fetches',
    'fetch_runs',
    'publications',
    'directory_counts',
    'directory_snapshots',
  ]);
}

export function openWarehouse(dbPath: string): DatabaseSync {
  if (dbPath !== ':memory:') {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  }
  const db = new DatabaseSync(dbPath);
  try {
    // Configure waiting before any pragma that may need a lock.
    db.exec('PRAGMA busy_timeout = 5000');
    db.exec('PRAGMA journal_mode = WAL');
    db.exec('PRAGMA foreign_keys = ON');
    initialize(db);
    if (!hasCurrentWarehouseTables(db)) {
      throw new Error(
        `Warehouse ${dbPath} is missing warehouse tables; delete it and rebuild`,
      );
    }
    if (!hasDerivedTables(db)) {
      rebuildDerived(db);
    }
    return db;
  } catch (error) {
    db.close();
    throw error;
  }
}
