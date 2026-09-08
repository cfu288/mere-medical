import { DatabaseSync } from 'node:sqlite';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { getRow } from '@mere/tenant-db';

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');
const DERIVED_FILE = path.join(__dirname, 'derived.sql');

interface Migration {
  version: number;
  name: string;
  sql: string;
}

export function readMigrations(): Migration[] {
  const migrations = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .map((file) => {
      const match = /^(\d+)_/.exec(file);
      if (!match) {
        throw new Error(`Migration '${file}' does not start with a number`);
      }
      return {
        version: Number(match[1]),
        name: file,
        sql: fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8'),
      };
    })
    .sort((a, b) => a.version - b.version);

  migrations.forEach((migration, index) => {
    if (migration.version !== index + 1) {
      throw new Error(
        `Migration '${migration.name}' breaks the sequence at ${index + 1}`,
      );
    }
  });
  return migrations;
}

function currentVersion(db: DatabaseSync): number {
  const row = getRow<{ user_version: number }>(
    db.prepare('PRAGMA user_version'),
  );
  return row?.user_version ?? 0;
}

function migrate(db: DatabaseSync): void {
  const version = currentVersion(db);
  for (const migration of readMigrations().filter((m) => m.version > version)) {
    db.exec('BEGIN');
    try {
      db.exec(migration.sql);
      db.exec(`PRAGMA user_version = ${migration.version}`);
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw new Error(`Migration '${migration.name}' failed: ${error}`);
    }
  }
}

/** Drops and rebuilds every table `transform` and `publish` regenerate from raw. */
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
    'raw_documents',
    'fetch_runs',
    'publications',
    'directory_observations',
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
    migrate(db);
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
