import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import { openWarehouse } from './db/open';
import * as downloads from './db/repository/capability-downloads';
import * as snapshots from './db/repository/directory-snapshots';
import { checkDirectory, extract } from './extract';

const SMART =
  'http://fhir-registry.smarthealthit.org/StructureDefinition/oauth-uris';

const CAPABILITY = JSON.stringify({
  resourceType: 'CapabilityStatement',
  rest: [
    {
      security: {
        extension: [
          {
            url: SMART,
            extension: [
              {
                url: 'authorize',
                valueUri: 'https://one.example.org/authorize',
              },
              { url: 'token', valueUri: 'https://one.example.org/token' },
            ],
          },
        ],
      },
    },
  ],
});

const DIRECTORY = JSON.stringify({
  resourceType: 'Bundle',
  entry: [
    {
      resource: {
        resourceType: 'Endpoint',
        id: 'epic-1',
        name: 'Example Health',
        address: 'https://one.example.org/api/FHIR/R4/',
      },
    },
  ],
});

const DIRECTORY_URL = 'https://directory.example.org/R4';
const NOW = '2026-08-23T00:00:00.000Z';
const silent = () => undefined;

describe('checkDirectory', () => {
  it('accepts a bundle whose declared total counts every entry', () => {
    expect(checkDirectory(6918, 13836, 13836)).toEqual({ ok: true });
  });

  it('rejects a bundle declaring a total its entries do not reach', () => {
    expect(checkDirectory(96, 96, 3326)).toEqual({
      ok: false,
      reason: 'directory declares total 3326 but holds 96 entries',
    });
  });

  it('rejects a directory that yielded no tenants', () => {
    expect(checkDirectory(0, 40, undefined)).toEqual({
      ok: false,
      reason: 'directory yielded no tenants',
    });
  });
});

describe('extract', () => {
  let dir: string;
  let db: DatabaseSync;
  const realFetch = globalThis.fetch;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'extract-'));
    db = openWarehouse(path.join(dir, 'warehouse.db'));
    process.env['EPIC_R4_ENDPOINTS_URL'] = DIRECTORY_URL;
  });

  afterEach(() => {
    db.close();
    globalThis.fetch = realFetch;
    fs.rmSync(dir, { recursive: true, force: true });
    delete process.env['EPIC_R4_ENDPOINTS_URL'];
  });

  function seedGoodCapability(): number {
    snapshots.appendSnapshot(db, 'epic', 'R4', NOW, DIRECTORY);
    const capabilityId = downloads.addUrl(
      db,
      {
        vendor: 'epic',
        fhirVersion: 'R4',
        url: 'https://one.example.org/api/FHIR/R4/metadata',
      },
      NOW,
    );
    downloads.recordSuccess(db, {
      id: capabilityId,
      body: CAPABILITY,
      now: NOW,
    });
    return capabilityId;
  }

  function respondWith(capabilityStatus: number, capabilityBody: string) {
    globalThis.fetch = (async (url: string | URL) => {
      if (String(url).includes('directory')) {
        return new Response(DIRECTORY, {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      return new Response(capabilityBody, {
        status: capabilityStatus,
        headers: { 'content-type': 'text/html' },
      });
    }) as typeof fetch;
  }

  async function run() {
    return extract(db, {
      vendor: 'epic',
      fhirVersion: 'R4',
      concurrency: 2,
      timeoutMs: 1000,
      directoryTimeoutMs: 5000,
      hostConcurrency: 2,
      hostFailureLimit: 0,
      retries: 0,
      batchSize: 10,
      now: () => '2026-09-01T00:00:00.000Z',
      log: silent,
    });
  }

  it('keeps a good body when the endpoint later answers 404', async () => {
    const capabilityId = seedGoodCapability();
    respondWith(404, '<html>404 Not Found</html>');

    await run();

    expect(downloads.findById(db, capabilityId)?.body).toBe(CAPABILITY);
  });

  it('keeps a good body when the endpoint answers 200 with non-JSON', async () => {
    const capabilityId = seedGoodCapability();
    respondWith(200, '<html>down for maintenance</html>');

    await run();
    const failed = db
      .prepare('SELECT failed AS n FROM capability_downloads WHERE id = ?')
      .get(capabilityId);

    expect(downloads.findById(db, capabilityId)?.body).toBe(CAPABILITY);
    expect(failed).toEqual({ n: 1 });
  });

  it('stores a directory snapshot when the crawl succeeds', async () => {
    respondWith(200, CAPABILITY);

    await run();

    expect(
      db
        .prepare('SELECT vendor, fhir_version, body FROM directory_snapshots')
        .all(),
    ).toEqual([{ vendor: 'epic', fhir_version: 'R4', body: DIRECTORY }]);
  });

  it('updates the saved copy date when the directory body is unchanged', () => {
    expect(snapshots.appendSnapshot(db, 'epic', 'R4', NOW, DIRECTORY)).toBe(
      true,
    );
    expect(
      snapshots.appendSnapshot(
        db,
        'epic',
        'R4',
        '2026-09-01T00:00:00.000Z',
        DIRECTORY,
      ),
    ).toBe(false);

    expect(
      db.prepare('SELECT fetched_at FROM directory_snapshots').all(),
    ).toEqual([{ fetched_at: '2026-09-01T00:00:00.000Z' }]);
  });

  it('keeps asking a host whose endpoints answer 404', async () => {
    const twoTenants = JSON.stringify({
      resourceType: 'Bundle',
      entry: [
        {
          resource: {
            resourceType: 'Endpoint',
            id: 'epic-1',
            name: 'Example Health',
            address: 'https://one.example.org/api/FHIR/R4/',
          },
        },
        {
          resource: {
            resourceType: 'Endpoint',
            id: 'epic-2',
            name: 'Second Health',
            address: 'https://one.example.org/second/api/FHIR/R4/',
          },
        },
      ],
    });
    const asked: string[] = [];
    globalThis.fetch = (async (url: string | URL) => {
      if (String(url).includes('directory')) {
        return new Response(twoTenants, {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      asked.push(String(url));
      return new Response('<html>404 Not Found</html>', {
        status: 404,
        headers: { 'content-type': 'text/html' },
      });
    }) as typeof fetch;

    await extract(db, {
      vendor: 'epic',
      fhirVersion: 'R4',
      concurrency: 1,
      timeoutMs: 1000,
      directoryTimeoutMs: 5000,
      hostConcurrency: 1,
      hostFailureLimit: 1,
      retries: 0,
      batchSize: 10,
      now: () => '2026-09-01T00:00:00.000Z',
      log: silent,
    });

    expect(asked.sort()).toEqual([
      'https://one.example.org/api/FHIR/R4/metadata',
      'https://one.example.org/second/api/FHIR/R4/metadata',
    ]);
  });

  it('keeps the saved directory copy when the server answers an error', async () => {
    seedGoodCapability();
    globalThis.fetch = (async () =>
      new Response('gone', { status: 404 })) as typeof fetch;

    await run();

    expect(db.prepare('SELECT body FROM directory_snapshots').all()).toEqual([
      { body: DIRECTORY },
    ]);
  });

  it('refuses to fetch a capability url the directory lists as http', async () => {
    let capabilityFetches = 0;
    globalThis.fetch = (async (url: string | URL) => {
      if (String(url).includes('directory')) {
        return new Response(
          JSON.stringify({
            resourceType: 'Bundle',
            entry: [
              {
                resource: {
                  resourceType: 'Endpoint',
                  id: 'epic-1',
                  name: 'Example Health',
                  address: 'http://127.0.0.1:8080/api/FHIR/R4/',
                },
              },
            ],
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      }
      capabilityFetches++;
      return new Response(CAPABILITY, { status: 200 });
    }) as typeof fetch;

    const result = await run();
    const document = downloads.findByUrl(db, {
      vendor: 'epic',
      fhirVersion: 'R4',
      url: 'http://127.0.0.1:8080/api/FHIR/R4/metadata',
    });

    expect({
      capabilityFetches,
      status: result.status,
      storedBody: document?.body,
    }).toEqual({
      capabilityFetches: 0,
      status: 'ok',
      storedBody: null,
    });
  });

  it('leaves a capability the directory no longer lists unfetched', async () => {
    seedGoodCapability();
    const delistedId = downloads.addUrl(
      db,
      {
        vendor: 'epic',
        fhirVersion: 'R4',
        url: 'https://gone.example.org/api/FHIR/R4/metadata',
      },
      NOW,
    );
    const requested: string[] = [];
    globalThis.fetch = (async (url: string | URL) => {
      if (String(url).includes('directory')) {
        return new Response(DIRECTORY, { status: 200 });
      }
      requested.push(String(url));
      return new Response(CAPABILITY, { status: 200 });
    }) as typeof fetch;

    await run();

    expect(requested).toEqual(['https://one.example.org/api/FHIR/R4/metadata']);
    expect(downloads.findById(db, delistedId)?.body).toBeNull();
  });

  it('records the rejection of a 200 directory body it cannot parse', async () => {
    seedGoodCapability();
    globalThis.fetch = (async () =>
      new Response('<html>maintenance</html>', {
        status: 200,
        headers: { 'content-type': 'text/html' },
      })) as typeof fetch;

    const result = await run();
    const attempt = db
      .prepare('SELECT attempted_at, error FROM directory_fetches')
      .get() as { attempted_at: string; error: string | null };

    expect({
      status: result.status,
      attemptedAt: attempt.attempted_at,
      rejected: attempt.error?.startsWith('directory body rejected'),
    }).toEqual({
      status: 'failed',
      attemptedAt: '2026-09-01T00:00:00.000Z',
      rejected: true,
    });
  });

  it('keeps the saved directory copy when a refetch loses every tenant', async () => {
    seedGoodCapability();
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ resourceType: 'Bundle', entry: [] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })) as typeof fetch;

    const result = await run();

    expect({
      status: result.status,
      snapshots: db.prepare('SELECT body FROM directory_snapshots').all(),
    }).toEqual({
      status: 'failed',
      snapshots: [{ body: DIRECTORY }],
    });
  });

  it('closes the run even when post-directory processing throws', async () => {
    respondWith(200, CAPABILITY);

    await expect(
      extract(db, {
        vendor: 'epic',
        fhirVersion: 'R4',
        concurrency: 1,
        hostConcurrency: 1,
        hostFailureLimit: 0,
        timeoutMs: 1000,
        directoryTimeoutMs: 5000,
        retries: 0,
        batchSize: 10,
        now: () => NOW,
        log: () => {
          throw new Error('log sink failed');
        },
      }),
    ).rejects.toThrow('log sink failed');

    expect(db.prepare('SELECT status FROM fetch_runs').all()).toEqual([
      { status: 'done' },
    ]);
  });
});
