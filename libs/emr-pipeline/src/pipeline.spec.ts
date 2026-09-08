import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { openWarehouse } from './db/open';
import * as raw from './db/repository/raw-documents';
import { buildArtifact, publish } from './publish';
import * as snapshots from './db/repository/directory-snapshots';
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
const silent = () => undefined;

describe('warehouse to artifact', () => {
  let dir: string;
  let warehousePath: string;
  let artifactPath: string;
  let db: DatabaseSync;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'emr-pipeline-'));
    warehousePath = path.join(dir, 'warehouse.db');
    artifactPath = path.join(dir, 'tenants.db');
    db = openWarehouse(warehousePath);
    process.env['EPIC_R4_ENDPOINTS_URL'] = 'https://directory.example.org/R4';
  });

  afterEach(() => {
    db.close();
    fs.rmSync(dir, { recursive: true, force: true });
    delete process.env['EPIC_R4_ENDPOINTS_URL'];
  });

  function seedEpicR4() {
    snapshots.appendSnapshot(db, 'epic', 'R4', NOW, EPIC_DIRECTORY);

    for (const host of ['one.example.org', 'two.example.org']) {
      const id = raw.trackDocument(
        db,
        {
          vendor: 'epic',
          fhirVersion: 'R4',
          docType: 'capability',
          url: `https://${host}/api/FHIR/R4/metadata`,
        },
        NOW,
      );
      raw.recordSuccess(db, {
        id,
        body: capabilityBody(host),
        now: NOW,
      });
    }
  }

  function capabilityDocument(): raw.RawDocumentRow {
    const document = raw.findByKey(db, {
      vendor: 'epic',
      fhirVersion: 'R4',
      docType: 'capability',
      url: 'https://one.example.org/api/FHIR/R4/metadata',
    });
    if (!document) throw new Error('capability document was not seeded');
    return document;
  }

  function publishOptions(overrides = {}) {
    return {
      warehousePath,
      artifactPath,
      now: () => NOW,
      log: silent,
      ...overrides,
    };
  }

  it('turns raw bodies into published rows a transform can replay offline', () => {
    seedEpicR4();

    const counts = transform(db, {
      vendor: 'epic',
      fhirVersion: 'R4',
      log: silent,
    });

    expect(counts).toEqual({
      directoryEntries: 2,
      capabilities: 2,
      unparseable: 0,
      duplicateTenantIds: 0,
    });
  });

  it('trims whitespace a directory leaves around a tenant name', () => {
    seedEpicR4();
    const padded = JSON.parse(EPIC_DIRECTORY);
    padded.entry[0].resource.name = 'Example Health\t';
    snapshots.appendSnapshot(
      db,
      'epic',
      'R4',
      '2026-08-24T00:00:00.000Z',
      JSON.stringify(padded),
    );

    transform(db, {
      vendor: 'epic',
      fhirVersion: 'R4',
      log: silent,
    });

    const row = db
      .prepare(
        `SELECT name FROM tenant_directory_entries
         WHERE vendor = 'epic' AND fhir_version = 'R4' AND tenant_id = 'epic-1'`,
      )
      .get() as unknown as { name: string };
    expect(row.name).toBe('Example Health');
  });

  it('collapses a tenant id repeated at the same url into one row', () => {
    seedEpicR4();
    const duplicated = JSON.parse(EPIC_DIRECTORY);
    duplicated.entry.push(duplicated.entry[0]);
    snapshots.appendSnapshot(
      db,
      'epic',
      'R4',
      '2026-08-24T00:00:00.000Z',
      JSON.stringify(duplicated),
    );

    const counts = transform(db, {
      vendor: 'epic',
      fhirVersion: 'R4',
      log: silent,
    });

    expect(counts).toEqual({
      directoryEntries: 2,
      capabilities: 2,
      unparseable: 0,
      duplicateTenantIds: 0,
    });
  });

  it('keeps the remembered listing when a tenant id turns ambiguous', () => {
    seedEpicR4();
    const conflicting = JSON.parse(EPIC_DIRECTORY);
    const clone = JSON.parse(JSON.stringify(conflicting.entry[0]));
    clone.resource.address = 'https://elsewhere.example.org/api/FHIR/R4';
    conflicting.entry.push(clone);
    snapshots.appendSnapshot(
      db,
      'epic',
      'R4',
      '2026-08-24T00:00:00.000Z',
      JSON.stringify(conflicting),
    );

    const counts = transform(db, {
      vendor: 'epic',
      fhirVersion: 'R4',
      log: silent,
    });

    expect(counts).toEqual({
      directoryEntries: 2,
      capabilities: 2,
      unparseable: 0,
      duplicateTenantIds: 1,
    });
    const rows = db
      .prepare(
        `SELECT tenant_id, last_seen_in_directory FROM tenant_directory_entries
         WHERE vendor = 'epic' AND fhir_version = 'R4' ORDER BY tenant_id`,
      )
      .all();
    expect(rows).toEqual([
      { tenant_id: 'epic-1', last_seen_in_directory: NOW },
      {
        tenant_id: 'epic-2',
        last_seen_in_directory: '2026-08-24T00:00:00.000Z',
      },
    ]);
  });

  it('folds athena practices into tenant directory entries', () => {
    snapshots.appendSnapshot(
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

    const counts = transform(db, {
      vendor: 'athena',
      fhirVersion: 'R4',
      log: silent,
    });

    expect(counts).toEqual({
      directoryEntries: 1,
      capabilities: 0,
      unparseable: 0,
      duplicateTenantIds: 0,
    });
    expect(
      db
        .prepare(
          "SELECT tenant_id, name, url FROM tenant_directory_entries WHERE vendor = 'athena'",
        )
        .all(),
    ).toEqual([
      {
        tenant_id: '12345',
        name: 'Sunrise Family Medicine',
        url: 'https://api.platform.athenahealth.com/fhir/r4',
      },
    ]);
  });

  it('keeps the fts index consistent when the artifact holds unsearchable rows', () => {
    db.prepare(
      `INSERT INTO tenant_directory_entries
         (vendor, fhir_version, tenant_id, name, url, managing_organization,
          last_seen_in_directory)
       VALUES ('athena', 'R4', '12345', 'Quiet Practice',
               'https://api.platform.athenahealth.com/fhir/r4', NULL,
               '2026-08-23T00:00:00.000Z')`,
    ).run();

    buildArtifact(warehousePath, artifactPath);

    const artifact = new DatabaseSync(artifactPath);
    expect(() =>
      artifact.exec(
        `INSERT INTO tenants_fts (tenants_fts, rank) VALUES ('integrity-check', 1)`,
      ),
    ).not.toThrow();
    artifact.close();
  });

  it('publishes the register endpoint a capability statement declares', () => {
    seedEpicR4();
    transform(db, {
      vendor: 'epic',
      fhirVersion: 'R4',
      log: silent,
    });
    publish(db, publishOptions());

    const artifact = new DatabaseSync(artifactPath, { readOnly: true });
    const row = artifact
      .prepare("SELECT register FROM tenants WHERE tenant_id = 'epic-1'")
      .get() as unknown as { register: string };
    artifact.close();

    expect(row.register).toBe('https://one.example.org/oauth2/register');
  });

  it('writes an artifact holding the directory rows and every sandbox seed', () => {
    seedEpicR4();
    transform(db, {
      vendor: 'epic',
      fhirVersion: 'R4',
      log: silent,
    });

    const result = publish(db, publishOptions());

    expect(result.rowCount).toBe(9);
    expect(fs.existsSync(artifactPath)).toBe(true);
  });

  it('records each publication for the status history', () => {
    seedEpicR4();
    transform(db, {
      vendor: 'epic',
      fhirVersion: 'R4',
      log: silent,
    });
    publish(db, publishOptions());

    const publications = db
      .prepare('SELECT published_at, row_count FROM publications')
      .all();

    expect(publications).toEqual([{ published_at: NOW, row_count: 9 }]);
  });

  it('keeps a failed capability fetch from erasing the body it already had', () => {
    seedEpicR4();
    const before = capabilityDocument();

    raw.recordFailure(db, {
      id: before.id,
      error: new Error('ECONNRESET'),
      now: '2026-08-24T00:00:00.000Z',
    });
    const after = raw.findById(db, before.id);

    expect(after?.raw).toBe(before.raw);
  });

  it('tracks the last attempted refresh apart from the last successful one', () => {
    seedEpicR4();
    const document = capabilityDocument();

    raw.recordFailure(db, {
      id: document.id,
      error: new Error('ECONNRESET'),
      now: '2026-08-24T00:00:00.000Z',
    });
    const row = db
      .prepare(
        'SELECT last_refreshed, last_sync_attempt FROM raw_documents WHERE id = ?',
      )
      .get(document.id);

    expect(row).toEqual({
      last_refreshed: NOW,
      last_sync_attempt: '2026-08-24T00:00:00.000Z',
    });
  });

  it('keeps last-good auth urls for a still-listed tenant whose metadata broke', () => {
    seedEpicR4();
    snapshots.appendSnapshot(
      db,
      'epic',
      'R4',
      '2026-08-24T00:00:00.000Z',
      EPIC_DIRECTORY,
    );
    raw.recordFailure(db, {
      id: capabilityDocument().id,
      error: new Error('endpoint answered 200 with a non-JSON body'),
      now: '2026-08-24T00:00:00.000Z',
    });
    transform(db, {
      vendor: 'epic',
      fhirVersion: 'R4',
      log: silent,
    });
    publish(db, publishOptions({ now: () => '2026-09-22T00:00:00.000Z' }));

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

  it('publishes the authorize url a re-crawled capability declares', () => {
    seedEpicR4();
    raw.recordSuccess(db, {
      id: capabilityDocument().id,
      body: capabilityBody('moved.example.org'),
      now: '2026-08-24T00:00:00.000Z',
    });
    transform(db, {
      vendor: 'epic',
      fhirVersion: 'R4',
      log: silent,
    });
    publish(db, publishOptions());

    const artifact = new DatabaseSync(artifactPath, { readOnly: true });
    const row = artifact
      .prepare("SELECT authorize FROM tenants WHERE tenant_id = 'epic-1'")
      .get();
    artifact.close();
    expect(row).toEqual({
      authorize: 'https://moved.example.org/oauth2/authorize',
    });
  });

  it('keeps the last non-empty name when a snapshot omits it', () => {
    seedEpicR4();
    const blank = JSON.parse(EPIC_DIRECTORY);
    blank.entry[0].resource.name = '';
    snapshots.appendSnapshot(
      db,
      'epic',
      'R4',
      '2026-08-24T00:00:00.000Z',
      JSON.stringify(blank),
    );
    transform(db, {
      vendor: 'epic',
      fhirVersion: 'R4',
      log: silent,
    });
    publish(db, publishOptions());

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

  it('keeps auth urls through a url move whose new endpoint has not answered', () => {
    seedEpicR4();
    const moved = JSON.parse(EPIC_DIRECTORY);
    moved.entry[0].resource.address = 'https://moved.example.org/api/FHIR/R4/';
    snapshots.appendSnapshot(
      db,
      'epic',
      'R4',
      '2026-08-24T00:00:00.000Z',
      JSON.stringify(moved),
    );
    transform(db, {
      vendor: 'epic',
      fhirVersion: 'R4',
      log: silent,
    });
    publish(db, publishOptions());

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

  it('publishes an omitted tenant with its original directory sighting', () => {
    seedEpicR4();
    const withoutFirst = JSON.stringify({
      resourceType: 'Bundle',
      entry: JSON.parse(EPIC_DIRECTORY).entry.slice(1),
    });
    snapshots.appendSnapshot(
      db,
      'epic',
      'R4',
      '2026-08-24T00:00:00.000Z',
      withoutFirst,
    );
    transform(db, {
      vendor: 'epic',
      fhirVersion: 'R4',
      log: silent,
    });

    expect(
      publish(db, publishOptions({ now: () => '2026-09-22T00:00:00.000Z' }))
        .rowCount,
    ).toBe(9);

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

  it('folds past an unparseable snapshot without losing tenants', () => {
    seedEpicR4();
    snapshots.appendSnapshot(
      db,
      'epic',
      'R4',
      '2026-08-24T00:00:00.000Z',
      '<html>not a bundle</html>',
    );

    const counts = transform(db, {
      vendor: 'epic',
      fhirVersion: 'R4',
      log: silent,
    });

    expect(counts.directoryEntries).toBe(2);
    expect(db.prepare('SELECT * FROM directory_observations').all()).toEqual([
      {
        vendor: 'epic',
        fhir_version: 'R4',
        last_observed_at: NOW,
        tenant_count: 2,
      },
    ]);
  });

  it('stamps sandbox rows from warehouse state rather than the clock', () => {
    seedEpicR4();
    transform(db, {
      vendor: 'epic',
      fhirVersion: 'R4',
      log: silent,
    });
    publish(db, publishOptions({ now: () => '2027-01-01T00:00:00.000Z' }));

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

  it('leaves a tenant the directory gave no name out of the artifact', () => {
    seedEpicR4();
    transform(db, {
      vendor: 'epic',
      fhirVersion: 'R4',
      log: silent,
    });
    db.exec(
      "UPDATE tenant_directory_entries SET name = '' WHERE tenant_id = 'epic-1'",
    );

    expect(publish(db, publishOptions()).rowCount).toBe(8);
  });

  it('replaces an unreadable artifact', () => {
    seedEpicR4();
    transform(db, {
      vendor: 'epic',
      fhirVersion: 'R4',
      log: silent,
    });
    fs.writeFileSync(artifactPath, 'not a sqlite file');

    expect(publish(db, publishOptions()).rowCount).toBe(9);
  });

  it('puts every capability document on the work list, never-fetched first', () => {
    seedEpicR4();
    raw.trackDocument(
      db,
      {
        vendor: 'epic',
        fhirVersion: 'R4',
        docType: 'capability',
        url: 'https://three.example.org/api/FHIR/R4/metadata',
      },
      NOW,
    );

    const worklist = raw.selectWorklist(db, {
      vendor: 'epic',
      fhirVersion: 'R4',
      docType: 'capability',
    });

    expect(worklist).toHaveLength(3);
    expect(worklist[0]?.url).toBe(
      'https://three.example.org/api/FHIR/R4/metadata',
    );
  });

  it('keeps the previous artifact when the build fails', () => {
    seedEpicR4();
    transform(db, {
      vendor: 'epic',
      fhirVersion: 'R4',
      log: silent,
    });
    publish(db, publishOptions());
    const good = fs.readFileSync(artifactPath).length;
    const notADatabase = path.join(dir, 'broken.db');
    fs.writeFileSync(notADatabase, 'not a sqlite file');

    expect(() => buildArtifact(notADatabase, artifactPath)).toThrow();
    expect(fs.readFileSync(artifactPath).length).toBe(good);
  });

  it('leaves no partial file behind when the build fails', () => {
    const notADatabase = path.join(dir, 'broken2.db');
    fs.writeFileSync(notADatabase, 'not a sqlite file');

    expect(() => buildArtifact(notADatabase, artifactPath)).toThrow();

    expect(fs.existsSync(`${artifactPath}.building`)).toBe(false);
  });

  it('creates the warehouse directory a fresh clone does not have', () => {
    const nested = path.join(dir, 'data', 'warehouse.db');

    const fresh = openWarehouse(nested);
    fresh.close();

    expect(fs.existsSync(nested)).toBe(true);
  });

  it('surfaces the rename failure when the artifact path is a directory', () => {
    fs.mkdirSync(artifactPath);

    expect(() => buildArtifact(warehousePath, artifactPath)).toThrow('EISDIR');
    expect(fs.existsSync(`${artifactPath}.building`)).toBe(false);
  });

  it('reopens an existing warehouse without losing raw bodies', () => {
    seedEpicR4();
    db.close();

    db = openWarehouse(warehousePath);
    const document = raw.findByKey(db, {
      vendor: 'epic',
      fhirVersion: 'R4',
      docType: 'capability',
      url: 'https://one.example.org/api/FHIR/R4/metadata',
    });

    expect(document?.raw).toBe(capabilityBody('one.example.org'));
  });

  it('waits briefly for a concurrent warehouse writer instead of failing immediately', () => {
    expect(db.prepare('PRAGMA busy_timeout').get()).toEqual({ timeout: 5000 });
  });

  it('leaves derived rows in place for a vendor with no snapshots yet', () => {
    seedEpicR4();
    transform(db, {
      vendor: 'epic',
      fhirVersion: 'R4',
      log: silent,
    });

    const counts = transform(db, {
      vendor: 'cerner',
      fhirVersion: 'R4',
      log: silent,
    });
    const remaining = db
      .prepare('SELECT COUNT(*) AS n FROM tenant_directory_entries')
      .get();

    expect({ counts: counts.directoryEntries, remaining }).toEqual({
      counts: 0,
      remaining: { n: 2 },
    });
  });
});
