import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { sql } from 'kysely';
import { openWarehouse, Warehouse } from '../db/open';
import * as downloads from '../db/repository/capability-downloads';
import { publish } from './publish';
import * as vendorTenantDirectory from '../db/repository/vendor-tenant-directory-snapshots';
import * as tenantListings from '../db/repository/tenant-listings';
import { transform } from './transform';

const SMART_URL =
  'http://fhir-registry.smarthealthit.org/StructureDefinition/oauth-uris';

const EPIC_DIRECTORY = JSON.stringify({
  resourceType: 'Bundle',
  entry: [
    {
      resource: {
        resourceType: 'Endpoint',
        id: 'epic-1',
        name: 'Example Health',
        address: 'https://one.example.org/api/FHIR/R4/',
        managingOrganization: { display: 'Example Health System' },
      },
    },
    {
      resource: {
        resourceType: 'Endpoint',
        id: 'epic-2',
        name: 'Second Health',
        address: 'https://two.example.org/api/FHIR/R4/',
        managingOrganization: { display: 'Second Health System' },
      },
    },
  ],
});

function capabilityBody(host: string) {
  return JSON.stringify({
    resourceType: 'CapabilityStatement',
    fhirVersion: '4.0.1',
    rest: [
      {
        security: {
          extension: [
            {
              url: SMART_URL,
              extension: [
                {
                  url: 'authorize',
                  valueUri: `https://${host}/oauth2/authorize`,
                },
                { url: 'token', valueUri: `https://${host}/oauth2/token` },
                {
                  url: 'register',
                  valueUri: `https://${host}/oauth2/register`,
                },
              ],
            },
          ],
        },
      },
    ],
  });
}

const NOW = '2026-08-23T00:00:00.000Z';

describe('warehouse to artifact', () => {
  let dir: string;
  let warehousePath: string;
  let artifactPath: string;
  let db: Warehouse;

  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'emr-pipeline-'));
    warehousePath = path.join(dir, 'warehouse.db');
    artifactPath = path.join(dir, 'tenants.db');
    db = openWarehouse(warehousePath);
    process.env['EPIC_R4_ENDPOINTS_URL'] = 'https://directory.example.org/R4';
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    await db.destroy();
    fs.rmSync(dir, { recursive: true, force: true });
    delete process.env['EPIC_R4_ENDPOINTS_URL'];
  });

  async function idOf(url: string): Promise<number> {
    const result = await sql<{
      id: number;
    }>`SELECT id FROM capability_downloads WHERE url = ${url}`.execute(db);
    return result.rows[0].id;
  }

  async function seedEpicR4() {
    await vendorTenantDirectory.saveSnapshot(
      db,
      'epic',
      'R4',
      NOW,
      EPIC_DIRECTORY,
    );

    for (const host of ['one.example.org', 'two.example.org']) {
      const url = `https://${host}/api/FHIR/R4/metadata`;
      await downloads.addUrl(db, { vendor: 'epic', fhirVersion: 'R4', url });
      await downloads.recordSuccess(db, {
        id: await idOf(url),
        body: capabilityBody(host),
        now: NOW,
      });
    }
  }

  async function capabilityDocument(): Promise<downloads.CapabilityDownload> {
    const document = await downloads.findByUrl(db, {
      vendor: 'epic',
      fhirVersion: 'R4',
      url: 'https://one.example.org/api/FHIR/R4/metadata',
    });
    if (!document) throw new Error('capability document was not seeded');
    return document;
  }

  it('turns raw bodies into published rows a transform can replay offline', async () => {
    await seedEpicR4();

    const counts = await transform(db, 'epic', 'R4');

    expect(counts).toEqual({
      directoryEntries: 2,
      capabilities: 2,
      unparseable: 0,
      duplicateTenantIds: 0,
    });
  });

  it('trims whitespace a directory leaves around a tenant name', async () => {
    await seedEpicR4();
    const padded = JSON.parse(EPIC_DIRECTORY);
    padded.entry[0].resource.name = 'Example Health\t';
    await vendorTenantDirectory.saveSnapshot(
      db,
      'epic',
      'R4',
      '2026-08-24T00:00:00.000Z',
      JSON.stringify(padded),
    );

    await transform(db, 'epic', 'R4');

    const result = await sql<{ name: string }>`SELECT name FROM tenant_names
         WHERE vendor = 'epic' AND fhir_version = 'R4' AND tenant_id = 'epic-1'`.execute(
      db,
    );
    expect(result.rows[0].name).toBe('Example Health');
  });

  it('collapses a tenant id repeated at the same url into one row', async () => {
    await seedEpicR4();
    const duplicated = JSON.parse(EPIC_DIRECTORY);
    duplicated.entry.push(duplicated.entry[0]);
    await vendorTenantDirectory.saveSnapshot(
      db,
      'epic',
      'R4',
      '2026-08-24T00:00:00.000Z',
      JSON.stringify(duplicated),
    );

    const counts = await transform(db, 'epic', 'R4');

    expect(counts).toEqual({
      directoryEntries: 2,
      capabilities: 2,
      unparseable: 0,
      duplicateTenantIds: 0,
    });
  });

  it('keeps the remembered listing when a tenant id turns ambiguous', async () => {
    await seedEpicR4();
    const conflicting = JSON.parse(EPIC_DIRECTORY);
    const clone = JSON.parse(JSON.stringify(conflicting.entry[0]));
    clone.resource.address = 'https://elsewhere.example.org/api/FHIR/R4';
    conflicting.entry.push(clone);
    await vendorTenantDirectory.saveSnapshot(
      db,
      'epic',
      'R4',
      '2026-08-24T00:00:00.000Z',
      JSON.stringify(conflicting),
    );

    const counts = await transform(db, 'epic', 'R4');

    expect(counts).toEqual({
      directoryEntries: 2,
      capabilities: 2,
      unparseable: 0,
      duplicateTenantIds: 1,
    });
    const result =
      await sql`SELECT tenant_id, url, last_seen_at FROM tenant_listings
         WHERE vendor = 'epic' AND fhir_version = 'R4' ORDER BY tenant_id, url`.execute(
        db,
      );
    expect(result.rows).toEqual([
      {
        tenant_id: 'epic-1',
        url: 'https://one.example.org/api/FHIR/R4/',
        last_seen_at: NOW,
      },
      {
        tenant_id: 'epic-2',
        url: 'https://two.example.org/api/FHIR/R4/',
        last_seen_at: '2026-08-24T00:00:00.000Z',
      },
    ]);
  });

  it('merges athena practices into tenant directory entries', async () => {
    await vendorTenantDirectory.saveSnapshot(
      db,
      'athena',
      'R4',
      NOW,
      JSON.stringify({
        resourceType: 'Bundle',
        entry: [
          {
            resource: {
              resourceType: 'Organization',
              name: 'Sunrise Family Medicine',
              extension: [
                {
                  url: 'https://fhir.athena.io/StructureDefinition/ah-practice',
                  valueReference: { reference: 'Organization/Practice-12345' },
                },
              ],
            },
          },
        ],
      }),
    );

    const counts = await transform(db, 'athena', 'R4');

    expect(counts).toEqual({
      directoryEntries: 1,
      capabilities: 0,
      unparseable: 0,
      duplicateTenantIds: 0,
    });
    expect(
      (
        await sql`SELECT n.tenant_id, n.name, l.url FROM tenant_names n
           JOIN tenant_listings l ON l.vendor = n.vendor
             AND l.fhir_version = n.fhir_version AND l.tenant_id = n.tenant_id
           WHERE n.vendor = 'athena'`.execute(db)
      ).rows,
    ).toEqual([
      {
        tenant_id: '12345',
        name: 'Sunrise Family Medicine',
        url: 'https://api.platform.athenahealth.com/fhir/r4',
      },
    ]);
  });

  it('publishes the register endpoint a capability statement declares', async () => {
    await seedEpicR4();
    await transform(db, 'epic', 'R4');
    await publish(db, artifactPath);

    const artifact = new DatabaseSync(artifactPath, { readOnly: true });
    const row = artifact
      .prepare("SELECT register FROM tenants WHERE tenant_id = 'epic-1'")
      .get() as unknown as { register: string };
    artifact.close();

    expect(row.register).toBe('https://one.example.org/oauth2/register');
  });

  it('writes an artifact holding the directory rows and every sandbox seed', async () => {
    await seedEpicR4();
    await transform(db, 'epic', 'R4');

    const result = await publish(db, artifactPath);

    expect(result.rowCount).toBe(9);
    expect(fs.existsSync(artifactPath)).toBe(true);
  });

  it('keeps a failed capability fetch from erasing the body it already had', async () => {
    await seedEpicR4();
    const before = await capabilityDocument();

    await downloads.recordFailure(db, {
      id: before.id,
      error: new Error('ECONNRESET'),
      now: '2026-08-24T00:00:00.000Z',
    });
    const after = await downloads.findById(db, before.id);

    expect(after?.body).toBe(before.body);
  });

  it('tracks the last attempted refresh apart from the last successful one', async () => {
    await seedEpicR4();
    const document = await capabilityDocument();

    await downloads.recordFailure(db, {
      id: document.id,
      error: new Error('ECONNRESET'),
      now: '2026-08-24T00:00:00.000Z',
    });
    const result = await sql`SELECT downloaded_at, attempted_at
         FROM capability_downloads WHERE id = ${document.id}`.execute(db);

    expect(result.rows[0]).toEqual({
      downloaded_at: NOW,
      attempted_at: '2026-08-24T00:00:00.000Z',
    });
  });

  it('keeps last-good auth urls for a still-listed tenant whose metadata broke', async () => {
    await seedEpicR4();
    await vendorTenantDirectory.saveSnapshot(
      db,
      'epic',
      'R4',
      '2026-08-24T00:00:00.000Z',
      EPIC_DIRECTORY,
    );
    await downloads.recordFailure(db, {
      id: (await capabilityDocument()).id,
      error: new Error('endpoint answered 200 with a non-JSON body'),
      now: '2026-08-24T00:00:00.000Z',
    });
    await transform(db, 'epic', 'R4');
    await publish(db, artifactPath);

    const artifact = new DatabaseSync(artifactPath, { readOnly: true });
    const row = artifact
      .prepare(
        `SELECT token, authorize, last_seen_in_directory FROM tenants
         WHERE vendor = 'epic' AND tenant_id = 'epic-1'`,
      )
      .get();
    artifact.close();
    expect(row).toEqual({
      token: 'https://one.example.org/oauth2/token',
      authorize: 'https://one.example.org/oauth2/authorize',
      last_seen_in_directory: '2026-08-24T00:00:00.000Z',
    });
  });

  it('publishes the authorize url a re-crawled capability declares', async () => {
    await seedEpicR4();
    await downloads.recordSuccess(db, {
      id: (await capabilityDocument()).id,
      body: capabilityBody('moved.example.org'),
      now: '2026-08-24T00:00:00.000Z',
    });
    await transform(db, 'epic', 'R4');
    await publish(db, artifactPath);

    const artifact = new DatabaseSync(artifactPath, { readOnly: true });
    const row = artifact
      .prepare("SELECT authorize FROM tenants WHERE tenant_id = 'epic-1'")
      .get();
    artifact.close();
    expect(row).toEqual({
      authorize: 'https://moved.example.org/oauth2/authorize',
    });
  });

  it('keeps the last non-empty name when a snapshot omits it', async () => {
    await seedEpicR4();
    const blank = JSON.parse(EPIC_DIRECTORY);
    blank.entry[0].resource.name = '';
    await vendorTenantDirectory.saveSnapshot(
      db,
      'epic',
      'R4',
      '2026-08-24T00:00:00.000Z',
      JSON.stringify(blank),
    );
    await transform(db, 'epic', 'R4');
    await publish(db, artifactPath);

    const artifact = new DatabaseSync(artifactPath, { readOnly: true });
    const row = artifact
      .prepare(
        `SELECT name, last_seen_in_directory FROM tenants
         WHERE tenant_id = 'epic-1'`,
      )
      .get();
    artifact.close();
    expect(row).toEqual({
      name: 'Example Health',
      last_seen_in_directory: '2026-08-24T00:00:00.000Z',
    });
  });

  it('keeps auth urls through a url move whose new endpoint has not answered', async () => {
    await seedEpicR4();
    const moved = JSON.parse(EPIC_DIRECTORY);
    moved.entry[0].resource.address = 'https://moved.example.org/api/FHIR/R4/';
    await vendorTenantDirectory.saveSnapshot(
      db,
      'epic',
      'R4',
      '2026-08-24T00:00:00.000Z',
      JSON.stringify(moved),
    );
    await transform(db, 'epic', 'R4');
    await publish(db, artifactPath);

    const artifact = new DatabaseSync(artifactPath, { readOnly: true });
    const row = artifact
      .prepare("SELECT url, authorize FROM tenants WHERE tenant_id = 'epic-1'")
      .get();
    artifact.close();
    expect(row).toEqual({
      url: 'https://moved.example.org/api/FHIR/R4/',
      authorize: 'https://one.example.org/oauth2/authorize',
    });
  });

  it('publishes an omitted tenant with its original directory sighting', async () => {
    await seedEpicR4();
    const withoutFirst = JSON.stringify({
      resourceType: 'Bundle',
      entry: JSON.parse(EPIC_DIRECTORY).entry.slice(1),
    });
    await vendorTenantDirectory.saveSnapshot(
      db,
      'epic',
      'R4',
      '2026-08-24T00:00:00.000Z',
      withoutFirst,
    );
    await transform(db, 'epic', 'R4');

    expect((await publish(db, artifactPath)).rowCount).toBe(9);

    const artifact = new DatabaseSync(artifactPath, { readOnly: true });
    const sightings = artifact
      .prepare(
        `SELECT tenant_id, last_seen_in_directory FROM tenants
         WHERE vendor = 'epic' AND source = 'directory' ORDER BY tenant_id`,
      )
      .all();
    artifact.close();
    expect(sightings).toEqual([
      { tenant_id: 'epic-1', last_seen_in_directory: NOW },
      {
        tenant_id: 'epic-2',
        last_seen_in_directory: '2026-08-24T00:00:00.000Z',
      },
    ]);
  });

  it('merges past an unparseable snapshot without losing tenants', async () => {
    await seedEpicR4();
    await vendorTenantDirectory.saveSnapshot(
      db,
      'epic',
      'R4',
      '2026-08-24T00:00:00.000Z',
      '<html>not a bundle</html>',
    );

    const counts = await transform(db, 'epic', 'R4');

    expect(counts.directoryEntries).toBe(2);
    expect(
      (await sql`SELECT * FROM directory_counts`.execute(db)).rows,
    ).toEqual([
      {
        vendor: 'epic',
        fhir_version: 'R4',
        seen_at: NOW,
        tenant_count: 2,
      },
    ]);
  });

  it('stamps sandbox rows from warehouse state rather than the clock', async () => {
    await seedEpicR4();
    await transform(db, 'epic', 'R4');
    await publish(db, artifactPath);

    const artifact = new DatabaseSync(artifactPath, { readOnly: true });
    const row = artifact
      .prepare(
        `SELECT last_seen_in_directory FROM tenants
         WHERE tenant_id = 'sandbox_epic_r4'`,
      )
      .get();
    artifact.close();
    expect(row).toEqual({ last_seen_in_directory: NOW });
  });

  it('leaves a tenant the directory gave no name out of the artifact', async () => {
    await seedEpicR4();
    await transform(db, 'epic', 'R4');
    await sql`UPDATE tenant_names SET name = NULL WHERE tenant_id = ${'epic-1'}`.execute(
      db,
    );

    expect((await publish(db, artifactPath)).rowCount).toBe(8);
  });

  it('leaves out a tenant whose only capability history is unusable', async () => {
    await vendorTenantDirectory.saveSnapshot(
      db,
      'epic',
      'R4',
      NOW,
      EPIC_DIRECTORY,
    );
    for (const host of ['one.example.org', 'two.example.org']) {
      const url = `https://${host}/api/FHIR/R4/metadata`;
      await downloads.addUrl(db, { vendor: 'epic', fhirVersion: 'R4', url });
    }
    await downloads.recordSuccess(db, {
      id: await idOf('https://one.example.org/api/FHIR/R4/metadata'),
      body: '<html>down for maintenance</html>',
      now: NOW,
    });
    await downloads.recordSuccess(db, {
      id: await idOf('https://two.example.org/api/FHIR/R4/metadata'),
      body: capabilityBody('two.example.org'),
      now: NOW,
    });
    await transform(db, 'epic', 'R4');
    await publish(db, artifactPath);

    const artifact = new DatabaseSync(artifactPath, { readOnly: true });
    const ids = (
      artifact
        .prepare(
          `SELECT tenant_id FROM tenants WHERE source = 'directory'
           ORDER BY tenant_id`,
        )
        .all() as { tenant_id: string }[]
    ).map((row) => row.tenant_id);
    artifact.close();
    expect(ids).toEqual(['epic-2']);
  });

  it('publishes the later-inserted listing when two urls share a date', async () => {
    await db.transaction().execute((trx) =>
      tenantListings.replace(
        trx,
        'epic',
        'R4',
        [
          {
            tenantId: 'epic-1',
            name: 'Example Health',
            managingOrganization: undefined,
            urls: [
              { url: 'https://one.example.org/api/FHIR/R4/', lastSeenAt: NOW },
              { url: 'https://two.example.org/api/FHIR/R4/', lastSeenAt: NOW },
            ],
          },
        ],
        [
          {
            url: 'https://one.example.org/api/FHIR/R4/',
            authorizeUrl: 'https://one.example.org/oauth2/authorize',
            tokenUrl: 'https://one.example.org/oauth2/token',
            registerUrl: null,
            classification: 'usable',
          },
          {
            url: 'https://two.example.org/api/FHIR/R4/',
            authorizeUrl: 'https://two.example.org/oauth2/authorize',
            tokenUrl: 'https://two.example.org/oauth2/token',
            registerUrl: null,
            classification: 'usable',
          },
        ],
      ),
    );

    const tenants = await tenantListings.listPublishable(db);

    expect(tenants).toEqual([
      {
        tenant_id: 'epic-1',
        vendor: 'epic',
        fhir_version: 'R4',
        name: 'Example Health',
        url: 'https://two.example.org/api/FHIR/R4/',
        token: 'https://two.example.org/oauth2/token',
        authorize: 'https://two.example.org/oauth2/authorize',
        register: null,
        managing_organization: null,
        kind: 'login',
        last_seen_in_directory: NOW,
      },
    ]);
  });

  it('leaves staging rows in place for a vendor with no directory snapshots yet', async () => {
    await seedEpicR4();
    await transform(db, 'epic', 'R4');

    const counts = await transform(db, 'cerner', 'R4');
    const remaining = (
      await sql<{ n: number }>`SELECT COUNT(*) AS n FROM tenant_names`.execute(
        db,
      )
    ).rows[0];

    expect({ counts: counts.directoryEntries, remaining }).toEqual({
      counts: 0,
      remaining: { n: 2 },
    });
  });
});
