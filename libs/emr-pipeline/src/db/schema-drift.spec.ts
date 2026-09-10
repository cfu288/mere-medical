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

  it('gives raw_documents the columns the repository reads', () => {
    expect(columnsOf(db, 'raw_documents')).toEqual([
      'doc_type',
      'fhir_version',
      'first_seen_at',
      'id',
      'last_error',
      'last_refreshed',
      'last_sync_attempt',
      'last_sync_was_error',
      'raw',
      'url',
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

  it('treats an empty fhir_version as a value rather than a null', () => {
    const now = '2026-08-23T00:00:00.000Z';
    const insert = db.prepare(
      `INSERT INTO raw_documents (vendor, fhir_version, doc_type, url, first_seen_at)
       VALUES ('athena', '', 'directory', 'https://example.org/dir', ?)
       ON CONFLICT (vendor, fhir_version, doc_type, url) DO NOTHING`,
    );
    insert.run(now);
    insert.run(now);

    expect(db.prepare('SELECT COUNT(*) AS n FROM raw_documents').get()).toEqual(
      {
        n: 1,
      },
    );
  });
});
