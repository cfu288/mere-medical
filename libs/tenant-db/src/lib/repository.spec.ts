import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { sql } from 'kysely';
import { DatabaseSync } from 'node:sqlite';
import { TENANT_DB_SCHEMA, TENANT_DB_USER_VERSION } from './schema';
import {
  TenantDb,
  findTenantById,
  openTenantDb,
  searchTenants,
  toFtsQuery,
} from './repository';

interface SeedRow {
  tenantId: string;
  vendor: string;
  fhirVersion: string;
  name: string;
  url: string;
  token?: string;
  authorize?: string;
  managingOrganization?: string;
  source?: string;
  kind?: 'login' | 'lookup';
  lastSeenInDirectory?: string;
}

const SEEDS: SeedRow[] = [
  {
    tenantId: 'epic-1',
    vendor: 'epic',
    fhirVersion: 'R4',
    name: 'Saint Joseph Medical Center',
    url: 'https://one.example.org/api/FHIR/R4/',
    token: 'https://one.example.org/oauth2/token',
    authorize: 'https://one.example.org/oauth2/authorize',
    managingOrganization: 'Mercy Health',
  },
  {
    tenantId: 'epic-2',
    vendor: 'epic',
    fhirVersion: 'R4',
    name: 'Mercy Hospital',
    url: 'https://two.example.org/api/FHIR/R4/',
    token: 'https://two.example.org/oauth2/token',
    authorize: 'https://two.example.org/oauth2/authorize',
  },
  {
    tenantId: 'sandbox_epic_r4',
    vendor: 'epic',
    fhirVersion: 'R4',
    name: 'Epic MyChart Sandbox (R4)',
    url: 'https://fhir.epic.com/api/FHIR/R4/',
    token: 'https://fhir.epic.com/oauth2/token',
    authorize: 'https://fhir.epic.com/oauth2/authorize',
    source: 'sandbox',
  },
  {
    tenantId: 'shared-id',
    vendor: 'cerner',
    fhirVersion: 'DSTU2',
    name: 'Both Versions Health DSTU2',
    url: 'https://three.example.org/dstu2/',
    token: 'https://three.example.org/dstu2/token',
    authorize: 'https://three.example.org/dstu2/authorize',
    lastSeenInDirectory: '2026-06-01T00:00:00.000Z',
  },
  {
    tenantId: 'shared-id',
    vendor: 'cerner',
    fhirVersion: 'R4',
    name: 'Both Versions Health R4',
    url: 'https://three.example.org/r4/',
    token: 'https://three.example.org/r4/token',
    authorize: 'https://three.example.org/r4/authorize',
  },
  {
    tenantId: 'epic-old',
    vendor: 'epic',
    fhirVersion: 'R4',
    name: 'Mercy Legacy Clinic',
    url: 'https://legacy.example.org/api/FHIR/R4/',
    token: 'https://legacy.example.org/oauth2/token',
    authorize: 'https://legacy.example.org/oauth2/authorize',
    lastSeenInDirectory: '2026-06-01T00:00:00.000Z',
  },
  {
    tenantId: '99001',
    vendor: 'athena',
    fhirVersion: 'R4',
    name: 'Athena Practice Mercy',
    url: 'https://api.platform.athenahealth.com/fhir/r4',
    kind: 'lookup',
  },
];

function writeArtifact(
  dir: string,
  rows: SeedRow[],
  userVersion: number,
): string {
  const dbPath = path.join(dir, 'tenants.db');
  const db = new DatabaseSync(dbPath);
  db.exec(TENANT_DB_SCHEMA);
  db.exec(`PRAGMA user_version = ${userVersion}`);
  const insert = db.prepare(
    `INSERT INTO tenants (tenant_id, vendor, fhir_version, name, url,
                          token, authorize, managing_organization, source,
                          kind, last_seen_in_directory)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  for (const row of rows) {
    insert.run(
      row.tenantId,
      row.vendor,
      row.fhirVersion,
      row.name,
      row.url,
      row.token ?? null,
      row.authorize ?? null,
      row.managingOrganization ?? null,
      row.source ?? 'directory',
      row.kind ?? 'login',
      row.lastSeenInDirectory ?? '2026-08-23T00:00:00.000Z',
    );
  }
  db.exec(
    `INSERT INTO tenants_fts (rowid, name, managing_organization)
     SELECT id, name, managing_organization FROM tenants`,
  );
  db.close();
  return dbPath;
}

describe('toFtsQuery', () => {
  it('turns each word into a quoted prefix term', () => {
    expect(toFtsQuery('saint joseph')).toBe('"saint"* "joseph"*');
  });

  it('quotes an fts operator a user typed', () => {
    expect(toFtsQuery('mercy OR NEAR')).toBe('"mercy"* "OR"* "NEAR"*');
  });

  it('drops punctuation a user typed', () => {
    expect(toFtsQuery("st. mary's (north)")).toBe(
      '"st"* "mary"* "s"* "north"*',
    );
  });

  it('keeps accented letters', () => {
    expect(toFtsQuery('hôpital')).toBe('"hôpital"*');
  });

  it('returns null for a query with nothing searchable in it', () => {
    expect(toFtsQuery('   "" *  ')).toBeNull();
  });
});

describe('tenant-db', () => {
  let dir: string;
  let db: TenantDb;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tenant-db-'));
    db = openTenantDb(writeArtifact(dir, SEEDS, TENANT_DB_USER_VERSION));
  });

  afterEach(async () => {
    await db.destroy();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('refuses an artifact built for another schema version', () => {
    const other = fs.mkdtempSync(path.join(os.tmpdir(), 'tenant-db-'));

    expect(() => openTenantDb(writeArtifact(other, SEEDS, 99))).toThrow(
      /schema version 99, expected 1/,
    );

    fs.rmSync(other, { recursive: true, force: true });
  });

  it('refuses an artifact holding no tenants', () => {
    const other = fs.mkdtempSync(path.join(os.tmpdir(), 'tenant-db-'));

    expect(() =>
      openTenantDb(writeArtifact(other, [], TENANT_DB_USER_VERSION)),
    ).toThrow(/holds no tenants/);

    fs.rmSync(other, { recursive: true, force: true });
  });

  it('finds a tenant by a prefix of its name', async () => {
    const names = (await searchTenants(db, 'jose')).map(
      (tenant) => tenant.name,
    );

    expect(names).toEqual(['Saint Joseph Medical Center']);
  });

  it('finds a tenant by its managing organization', async () => {
    const ids = (await searchTenants(db, 'mercy')).map(
      (tenant) => tenant.tenantId,
    );

    expect(ids.sort()).toEqual(['epic-1', 'epic-2', 'epic-old']);
  });

  it('keeps athena practices out of search results', async () => {
    const vendors = (await searchTenants(db, 'mercy')).map(
      (tenant) => tenant.vendor,
    );

    expect(vendors).not.toContain('athena');
  });

  it('treats a typed fts operator as text rather than syntax', async () => {
    expect(await searchTenants(db, 'mercy OR joseph')).toEqual([]);
  });

  it('lists tenants by name when the query is empty', async () => {
    const names = (await searchTenants(db, '')).map((tenant) => tenant.name);

    expect(names).toEqual([
      'Both Versions Health DSTU2',
      'Both Versions Health R4',
      'Epic MyChart Sandbox (R4)',
      'Mercy Hospital',
      'Mercy Legacy Clinic',
      'Saint Joseph Medical Center',
    ]);
  });

  it('filters an empty query to one vendor', async () => {
    const vendors = new Set(
      (await searchTenants(db, '', { vendors: ['cerner'] })).map(
        (t) => t.vendor,
      ),
    );

    expect([...vendors]).toEqual(['cerner']);
  });

  it('filters a matching query to sandbox rows only', async () => {
    const ids = (await searchTenants(db, 'epic', { source: 'sandbox' })).map(
      (tenant) => tenant.tenantId,
    );

    expect(ids).toEqual(['sandbox_epic_r4']);
  });

  it('filters a matching query to one fhir version', async () => {
    const names = (
      await searchTenants(db, 'both', { fhirVersion: 'DSTU2' })
    ).map((tenant) => tenant.name);

    expect(names).toEqual(['Both Versions Health DSTU2']);
  });

  it('returns nothing for a query that holds no searchable token', async () => {
    expect(await searchTenants(db, '---')).toEqual([]);
  });

  it('returns nothing for a non-string query value', async () => {
    expect(await searchTenants(db, ['one', 'two'])).toEqual([]);
  });

  it('lists the browse page when the query is empty', async () => {
    expect(await searchTenants(db, '   ')).toHaveLength(6);
  });

  it('serves a tenant however old its directory sighting is', async () => {
    const names = (await searchTenants(db, 'legacy')).map(
      (tenant) => tenant.name,
    );

    expect(names).toEqual(['Mercy Legacy Clinic']);
    expect((await findTenantById(db, 'epic', 'epic-old'))?.name).toBe(
      'Mercy Legacy Clinic',
    );
  });

  it('returns the r4 row for an id published under both versions', async () => {
    const tenant = await findTenantById(db, 'cerner', 'shared-id');

    expect(tenant?.name).toBe('Both Versions Health R4');
  });

  it('returns the requested version for an id published under both', async () => {
    const tenant = await findTenantById(db, 'cerner', 'shared-id', 'DSTU2');

    expect(tenant?.name).toBe('Both Versions Health DSTU2');
  });

  it('finds an athena practice that search deliberately hides', async () => {
    const tenant = await findTenantById(db, 'athena', '99001');

    expect(tenant).toEqual({
      kind: 'lookup',
      tenantId: '99001',
      vendor: 'athena',
      fhirVersion: 'R4',
      name: 'Athena Practice Mercy',
      url: 'https://api.platform.athenahealth.com/fhir/r4',
      managingOrganization: undefined,
      source: 'directory',
    });
  });

  it('returns null for a tenant id no vendor publishes', async () => {
    expect(await findTenantById(db, 'epic', 'nope')).toBeNull();
  });

  it('opens the artifact read only', async () => {
    await expect(
      sql`UPDATE tenants SET name = ${'changed'} WHERE tenant_id = ${'epic-1'}`.execute(
        db,
      ),
    ).rejects.toThrow();
  });
});
