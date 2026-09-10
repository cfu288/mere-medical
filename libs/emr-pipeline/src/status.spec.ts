import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import { openWarehouse } from './db/open';
import { formatStatus } from './status';

const NOW = '2026-09-07T12:00:00.000Z';

describe('formatStatus', () => {
  let dir: string;
  let db: DatabaseSync;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'emr-status-'));
    db = openWarehouse(path.join(dir, 'warehouse.db'));
  });

  afterEach(() => {
    db.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('shows never for a warehouse nothing has run against', () => {
    expect(formatStatus(db, NOW)).toBe(
      [
        'vendor     version  endpoints   failing crawled   transform',
        'athena     R4               -         0 never     -',
        'cerner     DSTU2            -         0 never     -',
        'cerner     R4               -         0 never     -',
        'epic       DSTU2            -         0 never     -',
        'epic       R4               -         0 never     -',
        'healow     R4               -         0 never     -',
        'veradigm   DSTU2            -         0 never     -',
        'veradigm   R4               -         0 never     -',
        '',
        'published: never',
      ].join('\n'),
    );
  });

  it('renders a crawled, transformed, published pipeline with failure growth', () => {
    db.exec(`
      INSERT INTO raw_documents (vendor, fhir_version, doc_type, url, first_seen_at, raw, last_refreshed)
      VALUES ('epic', 'R4', 'directory', 'https://directory.example.org/R4',
              '2026-08-26T12:00:00.000Z', '{}', '2026-08-26T12:00:00.000Z');
      INSERT INTO raw_documents (vendor, fhir_version, doc_type, url, first_seen_at, last_sync_was_error)
      VALUES ('epic', 'R4', 'capability', 'https://a.example.org/metadata', '2026-08-26T12:00:00.000Z', 1),
             ('epic', 'R4', 'capability', 'https://b.example.org/metadata', '2026-08-26T12:00:00.000Z', 1);
      INSERT INTO directory_counts (vendor, fhir_version, seen_at, tenant_count)
      VALUES ('epic', 'R4', '2026-08-26T12:00:00.000Z', 815);
      INSERT INTO fetch_runs (vendor, fhir_version, status, failed)
      VALUES ('epic', 'R4', 'done', 0),
             ('epic', 'R4', 'done', 2);
      INSERT INTO publications (published_at, row_count)
      VALUES ('2026-09-05T10:00:00.000Z', 9),
             ('2026-09-06T10:00:00.000Z', 6),
             ('2026-09-07T10:00:00.000Z', 8);
    `);

    expect(formatStatus(db, NOW)).toBe(
      [
        'vendor     version  endpoints   failing crawled   transform',
        'athena     R4               -         0 never     -',
        'cerner     DSTU2            -         0 never     -',
        'cerner     R4               -         0 never     -',
        'epic       DSTU2            -         0 never     -',
        'epic       R4             815    2 (+2) 12d ago   current',
        'healow     R4               -         0 never     -',
        'veradigm   DSTU2            -         0 never     -',
        'veradigm   R4               -         0 never     -',
        '',
        'publishes',
        '  today     8 rows (+2)',
        '  1d ago    6 rows (-3)',
        '  2d ago    9 rows',
      ].join('\n'),
    );
  });

  it('keeps failure deltas separate per vendor and version', () => {
    db.exec(`
      INSERT INTO raw_documents (vendor, fhir_version, doc_type, url, first_seen_at, last_sync_was_error)
      VALUES ('epic', 'DSTU2', 'capability', 'https://a.example.org/dstu2/metadata', '2026-08-26T12:00:00.000Z', 1),
             ('epic', 'R4', 'capability', 'https://a.example.org/r4/metadata', '2026-08-26T12:00:00.000Z', 1),
             ('epic', 'R4', 'capability', 'https://b.example.org/r4/metadata', '2026-08-26T12:00:00.000Z', 1),
             ('cerner', 'R4', 'capability', 'https://c.example.org/r4/metadata', '2026-08-26T12:00:00.000Z', 1);
      INSERT INTO fetch_runs (vendor, fhir_version, status, failed)
      VALUES ('epic', 'DSTU2', 'done', 2),
             ('epic', 'DSTU2', 'done', 1),
             ('epic', 'R4', 'done', 0),
             ('epic', 'R4', 'done', 2),
             ('cerner', 'R4', 'done', 1),
             ('cerner', 'R4', 'done', 1);
    `);

    expect(formatStatus(db, NOW)).toBe(
      [
        'vendor     version  endpoints   failing crawled   transform',
        'athena     R4               -         0 never     -',
        'cerner     DSTU2            -         0 never     -',
        'cerner     R4               -         1 never     -',
        'epic       DSTU2            -    1 (-1) never     -',
        'epic       R4               -    2 (+2) never     -',
        'healow     R4               -         0 never     -',
        'veradigm   DSTU2            -         0 never     -',
        'veradigm   R4               -         0 never     -',
        '',
        'published: never',
      ].join('\n'),
    );
  });

  it('flags a crawl the transform has not consumed', () => {
    db.exec(`
      INSERT INTO raw_documents (vendor, fhir_version, doc_type, url, first_seen_at, raw, last_refreshed)
      VALUES ('epic', 'R4', 'directory', 'https://directory.example.org/R4',
              '2026-08-07T00:00:00.000Z', '{}', '2026-09-07T09:00:00.000Z');
      INSERT INTO raw_documents (vendor, fhir_version, doc_type, url, first_seen_at, last_sync_was_error)
      VALUES ('epic', 'R4', 'capability', 'https://a.example.org/metadata', '2026-08-07T00:00:00.000Z', 1),
             ('epic', 'R4', 'capability', 'https://b.example.org/metadata', '2026-08-07T00:00:00.000Z', 1),
             ('epic', 'R4', 'capability', 'https://c.example.org/metadata', '2026-08-07T00:00:00.000Z', 1);
      INSERT INTO directory_counts (vendor, fhir_version, seen_at, tenant_count)
      VALUES ('epic', 'R4', '2026-08-07T00:00:00.000Z', 815);
      INSERT INTO publications (published_at, row_count)
      VALUES ('2026-08-01T10:00:00.000Z', 44900),
             ('2026-08-02T10:00:00.000Z', 44910),
             ('2026-08-03T10:00:00.000Z', 44920),
             ('2026-08-04T10:00:00.000Z', 44930),
             ('2026-08-05T10:00:00.000Z', 44945),
             ('2026-08-07T10:00:00.000Z', 44958);
    `);

    expect(formatStatus(db, NOW)).toBe(
      [
        'vendor     version  endpoints   failing crawled   transform',
        'athena     R4               -         0 never     -',
        'cerner     DSTU2            -         0 never     -',
        'cerner     R4               -         0 never     -',
        'epic       DSTU2            -         0 never     -',
        'epic       R4             815         3 today     BEHIND',
        'healow     R4               -         0 never     -',
        'veradigm   DSTU2            -         0 never     -',
        'veradigm   R4               -         0 never     -',
        '',
        'publishes',
        '  31d ago   44,958 rows (+13)',
        '  33d ago   44,945 rows (+15)',
        '  34d ago   44,930 rows (+10)',
        '  35d ago   44,920 rows (+10)',
        '  36d ago   44,910 rows (+10)',
      ].join('\n'),
    );
  });
});
