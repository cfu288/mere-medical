import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import { openWarehouse } from './db/open';
import * as raw from './db/repository/raw-documents';
import * as snapshots from './db/repository/directory-snapshots';
import { checkDirectory, extract, runPool } from './extract';

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

describe('runPool', () => {
  it('holds a host to its own concurrency cap', async () => {
    const inFlight: string[] = [];
    let maxPerHost = 0;
    const tasks = ['a', 'a', 'a', 'a', 'a', 'b'].map((host, index) => ({
      host,
      run: async () => {
        inFlight.push(host);
        maxPerHost = Math.max(
          maxPerHost,
          inFlight.filter((h) => h === host).length,
        );
        await new Promise((resolve) => setTimeout(resolve, 5));
        inFlight.splice(inFlight.indexOf(host), 1);
        return index;
      },
    }));

    const results: number[] = [];
    await runPool<number | null>(
      tasks,
      {
        concurrency: 6,
        hostConcurrency: 2,
        hostFailureLimit: 0,
        failed: () => false,
        skipped: () => null,
      },
      (result) => results.push(result as number),
    );

    expect(maxPerHost).toBe(2);
    expect(results.sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it('stops requesting a host that keeps failing with nothing succeeding', async () => {
    let attempts = 0;
    const tasks = Array.from({ length: 20 }, () => ({
      host: 'dead.example.org',
      run: async () => {
        attempts++;
        return { ok: false };
      },
    }));

    const skipped: unknown[] = [];
    const abandoned = await runPool<{ ok: boolean } | { skippedHost: string }>(
      tasks,
      {
        concurrency: 2,
        hostConcurrency: 2,
        hostFailureLimit: 5,
        failed: (result) => !(result as { ok: boolean }).ok,
        skipped: (host) => ({ skippedHost: host }),
      },
      (result) => skipped.push(result),
    );

    expect({ attempts, abandoned: abandoned.get('dead.example.org') }).toEqual({
      attempts: 6,
      abandoned: 14,
    });
  });

  it('keeps requesting a host that failed but also succeeded', async () => {
    let attempts = 0;
    const tasks = Array.from({ length: 12 }, (_, index) => ({
      host: 'flaky.example.org',
      run: async () => {
        attempts++;
        return { ok: index === 0 };
      },
    }));

    const abandoned = await runPool<{ ok: boolean } | null>(
      tasks,
      {
        concurrency: 1,
        hostConcurrency: 1,
        hostFailureLimit: 3,
        failed: (result) => !(result as { ok: boolean }).ok,
        skipped: () => null,
      },
      () => undefined,
    );

    expect({ attempts, abandoned: abandoned.size }).toEqual({
      attempts: 12,
      abandoned: 0,
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
    const directoryId = raw.trackDocument(
      db,
      {
        vendor: 'epic',
        fhirVersion: 'R4',
        docType: 'directory',
        url: DIRECTORY_URL,
      },
      NOW,
    );
    raw.recordSuccess(db, {
      id: directoryId,
      body: DIRECTORY,
      now: NOW,
    });
    const capabilityId = raw.trackDocument(
      db,
      {
        vendor: 'epic',
        fhirVersion: 'R4',
        docType: 'capability',
        url: 'https://one.example.org/api/FHIR/R4/metadata',
      },
      NOW,
    );
    raw.recordSuccess(db, {
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

    expect(raw.findById(db, capabilityId)?.raw).toBe(CAPABILITY);
  });

  it('keeps a good body when the endpoint answers 200 with non-JSON', async () => {
    const capabilityId = seedGoodCapability();
    respondWith(200, '<html>down for maintenance</html>');

    await run();
    const failed = db
      .prepare(
        'SELECT last_sync_was_error AS n FROM raw_documents WHERE id = ?',
      )
      .get(capabilityId);

    expect(raw.findById(db, capabilityId)?.raw).toBe(CAPABILITY);
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

  it('advances the latest snapshot when the directory body is unchanged', () => {
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

  it('reports a run whose capability fetches failed as ok', async () => {
    seedGoodCapability();
    respondWith(404, '<html>404 Not Found</html>');

    const result = await run();

    expect(result.status).toBe('ok');
  });

  it('asks once when the endpoint answers 404', async () => {
    seedGoodCapability();
    let attempts = 0;
    globalThis.fetch = (async (url: string | URL) => {
      if (String(url).includes('directory')) {
        return new Response(DIRECTORY, { status: 200 });
      }
      attempts++;
      return new Response('gone', { status: 404 });
    }) as typeof fetch;

    await extract(db, {
      vendor: 'epic',
      fhirVersion: 'R4',
      concurrency: 2,
      hostConcurrency: 2,
      hostFailureLimit: 0,
      timeoutMs: 1000,
      directoryTimeoutMs: 5000,
      retries: 3,
      batchSize: 10,
      now: () => NOW,
      log: silent,
    });

    expect(attempts).toBe(1);
  });

  it('retries a 503 up to the retry budget', async () => {
    seedGoodCapability();
    let attempts = 0;
    globalThis.fetch = (async (url: string | URL) => {
      if (String(url).includes('directory')) {
        return new Response(DIRECTORY, { status: 200 });
      }
      attempts++;
      return new Response('busy', { status: 503 });
    }) as typeof fetch;

    await extract(db, {
      vendor: 'epic',
      fhirVersion: 'R4',
      concurrency: 2,
      hostConcurrency: 2,
      hostFailureLimit: 0,
      timeoutMs: 1000,
      directoryTimeoutMs: 5000,
      retries: 2,
      batchSize: 10,
      now: () => NOW,
      log: silent,
    });

    expect(attempts).toBe(3);
  });

  it('marks a document failed once its 5xx retries run out', async () => {
    const capabilityId = seedGoodCapability();
    respondWith(503, 'busy');

    await run();
    const failed = db
      .prepare(
        'SELECT last_sync_was_error AS n FROM raw_documents WHERE id = ?',
      )
      .get(capabilityId);

    expect(failed).toEqual({ n: 1 });
    expect(raw.findById(db, capabilityId)?.raw).toBe(CAPABILITY);
  });

  it('keeps the stored directory body when the server answers an error', async () => {
    seedGoodCapability();
    globalThis.fetch = (async () =>
      new Response('gone', { status: 404 })) as typeof fetch;

    await run();
    const directory = raw.findByKey(db, {
      vendor: 'epic',
      fhirVersion: 'R4',
      docType: 'directory',
      url: DIRECTORY_URL,
    });

    expect(directory?.raw).toBe(DIRECTORY);
  });

  it('stores a body the endpoint answers with 200', async () => {
    const capabilityId = seedGoodCapability();
    respondWith(200, CAPABILITY.replace('one.example', 'moved.example'));

    await run();

    expect(raw.findById(db, capabilityId)?.raw).toContain('moved.example');
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
    const document = raw.findByKey(db, {
      vendor: 'epic',
      fhirVersion: 'R4',
      docType: 'capability',
      url: 'http://127.0.0.1:8080/api/FHIR/R4/metadata',
    });

    expect({
      capabilityFetches,
      status: result.status,
      storedBody: document?.raw,
    }).toEqual({
      capabilityFetches: 0,
      status: 'ok',
      storedBody: null,
    });
  });

  it('leaves a capability the directory no longer lists unfetched', async () => {
    seedGoodCapability();
    const delistedId = raw.trackDocument(
      db,
      {
        vendor: 'epic',
        fhirVersion: 'R4',
        docType: 'capability',
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
    expect(raw.findById(db, delistedId)?.raw).toBeNull();
  });

  it('stores a 200 directory body it cannot parse without a transport failure', async () => {
    seedGoodCapability();
    globalThis.fetch = (async () =>
      new Response('<html>maintenance</html>', {
        status: 200,
        headers: { 'content-type': 'text/html' },
      })) as typeof fetch;

    const result = await run();
    const directory = raw.findByKey(db, {
      vendor: 'epic',
      fhirVersion: 'R4',
      docType: 'directory',
      url: DIRECTORY_URL,
    });

    expect({
      status: result.status,
      storedBody: directory?.raw,
    }).toEqual({
      status: 'failed',
      storedBody: '<html>maintenance</html>',
    });
  });

  it('keeps the good directory body when a refetch loses every tenant', async () => {
    seedGoodCapability();
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ resourceType: 'Bundle', entry: [] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })) as typeof fetch;

    const result = await run();
    const directory = raw.findByKey(db, {
      vendor: 'epic',
      fhirVersion: 'R4',
      docType: 'directory',
      url: DIRECTORY_URL,
    });

    expect({
      status: result.status,
      storedBody: directory?.raw,
      snapshots: db
        .prepare('SELECT COUNT(*) AS n FROM directory_snapshots')
        .get(),
    }).toEqual({
      status: 'failed',
      storedBody: DIRECTORY,
      snapshots: { n: 0 },
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
