import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { TENANT_DB_SCHEMA } from '@mere/tenant-db';
import { openWarehouse } from './open';

function columnsOf(db: DatabaseSync, table: string): string[] {
  return (db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[])
    .map((column) => column.name)
    .sort();
}

describe('schema drift', () => {
  let dir: string;
  let db: DatabaseSync;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'emr-schema-'));
    db = openWarehouse(path.join(dir, 'warehouse.db'));
  });

  afterEach(() => {
    db.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('marks a fresh warehouse as schema version one', () => {
    expect(db.prepare('PRAGMA user_version').get()).toEqual({
      user_version: 1,
    });
  });

  it('gives capability_downloads the columns the repository reads', () => {
    expect(columnsOf(db, 'capability_downloads')).toEqual([
      'attempted_at',
      'body',
      'downloaded_at',
      'error',
      'failed',
      'fhir_version',
      'first_seen_at',
      'id',
      'url',
      'vendor',
    ]);
  });

  it('tracks when each directory was last requested', () => {
    expect(columnsOf(db, 'directory_fetches')).toEqual([
      'attempted_at',
      'error',
      'fhir_version',
      'vendor',
    ]);
  });

  it('gives fetch_runs the columns the repository reads', () => {
    expect(columnsOf(db, 'fetch_runs')).toEqual([
      'failed',
      'fhir_version',
      'id',
      'status',
      'vendor',
    ]);
  });

  it('keeps every directory body the crawl has ever accepted', () => {
    expect(columnsOf(db, 'directory_snapshots')).toEqual([
      'body',
      'fetched_at',
      'fhir_version',
      'id',
      'vendor',
    ]);
  });

  it('records the latest parsed tenant count per directory', () => {
    expect(columnsOf(db, 'directory_counts')).toEqual([
      'fhir_version',
      'seen_at',
      'tenant_count',
      'vendor',
    ]);
  });

  it('ships the tenant columns publish derives', () => {
    const artifact = new DatabaseSync(path.join(dir, 'tenants.db'));
    artifact.exec(TENANT_DB_SCHEMA);
    const tenants = columnsOf(artifact, 'tenants');
    artifact.close();

    expect(tenants).toEqual([
      'authorize',
      'fhir_version',
      'id',
      'last_seen_in_directory',
      'managing_organization',
      'name',
      'register',
      'searchable',
      'source',
      'tenant_id',
      'token',
      'url',
      'vendor',
    ]);
  });
});
