import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { Response } from 'express';
import {
  TENANT_DB_SCHEMA,
  TENANT_DB_USER_VERSION,
  openTenantDb,
} from '@mere/tenant-db';
import { TenantController } from './tenant.controller';
import { TenantService } from './tenant.service';

describe('TenantController', () => {
  let dir: string;
  let controller: TenantController;
  let db: ReturnType<typeof openTenantDb>;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tenant-'));
    const artifactPath = path.join(dir, 'tenants.db');
    const artifact = new DatabaseSync(artifactPath);
    artifact.exec(TENANT_DB_SCHEMA);
    artifact.exec(`PRAGMA user_version = ${TENANT_DB_USER_VERSION}`);
    const insert = artifact.prepare(
      `INSERT INTO tenants
         (tenant_id, vendor, fhir_version, name, url, token, authorize,
          source, searchable, last_seen_in_directory)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    insert.run(
      'epic-1',
      'epic',
      'R4',
      'Mercy Health',
      'https://epic.example.org/api/FHIR/R4/',
      'https://epic.example.org/oauth2/token',
      'https://epic.example.org/oauth2/authorize',
      'directory',
      1,
      '2026-08-23T00:00:00.000Z',
    );
    insert.run(
      'cerner-1',
      'cerner',
      'DSTU2',
      'Mercy Clinic',
      'https://cerner.example.org/dstu2/',
      'https://cerner.example.org/token',
      'https://cerner.example.org/authorize',
      'directory',
      1,
      '2026-08-23T00:00:00.000Z',
    );
    artifact.exec(
      `INSERT INTO tenants_fts (rowid, name, managing_organization)
       SELECT id, name, managing_organization FROM tenants WHERE searchable = 1`,
    );
    artifact.close();
    db = openTenantDb(artifactPath);
    controller = new TenantController(new TenantService(db));
  });

  afterEach(async () => {
    await db.destroy();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  function jsonCapture(): { response: Response; body: () => unknown } {
    let captured: unknown;
    const response = {
      json: (value: unknown) => {
        captured = value;
      },
    } as unknown as Response;
    return { response, body: () => captured };
  }

  it('answers an R4 search with the vendor and version on each entry', async () => {
    const { response, body } = jsonCapture();

    await controller.getR4Tenants(response, 'mercy');

    expect(body()).toEqual([
      {
        id: 'epic-1',
        url: 'https://epic.example.org/api/FHIR/R4/',
        name: 'Mercy Health',
        token: 'https://epic.example.org/oauth2/token',
        authorize: 'https://epic.example.org/oauth2/authorize',
        managingOrganization: undefined,
        vendor: 'EPIC',
        version: 'R4',
      },
    ]);
  });

  it('answers a DSTU2 search with only DSTU2 tenants', async () => {
    const { response, body } = jsonCapture();

    await controller.getDSTU2Tenants(response, 'mercy');

    expect(body()).toEqual([
      {
        id: 'cerner-1',
        url: 'https://cerner.example.org/dstu2/',
        name: 'Mercy Clinic',
        token: 'https://cerner.example.org/token',
        authorize: 'https://cerner.example.org/authorize',
        managingOrganization: undefined,
        vendor: 'CERNER',
        version: 'DSTU2',
      },
    ]);
  });

  it('answers an empty query with the browse list', async () => {
    const { response, body } = jsonCapture();

    await controller.getR4Tenants(response, '');

    expect((body() as { name: string }[]).map((e) => e.name)).toEqual([
      'Mercy Health',
    ]);
  });
});
