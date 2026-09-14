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
import { AthenaController } from './athena.controller';
import { AthenaService } from './athena.service';

describe('AthenaController', () => {
  let dir: string;
  let controller: AthenaController;
  let db: ReturnType<typeof openTenantDb>;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'athena-'));
    const artifactPath = path.join(dir, 'tenants.db');
    const artifact = new DatabaseSync(artifactPath);
    artifact.exec(TENANT_DB_SCHEMA);
    artifact.exec(`PRAGMA user_version = ${TENANT_DB_USER_VERSION}`);
    artifact
      .prepare(
        `INSERT INTO tenants
           (tenant_id, vendor, fhir_version, name, url, source, searchable,
            last_seen_in_directory)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        '12345',
        'athena',
        'R4',
        'Sunrise Family Medicine',
        'https://api.platform.athenahealth.com/fhir/r4',
        'directory',
        0,
        '2026-08-23T00:00:00.000Z',
      );
    artifact.close();
    db = openTenantDb(artifactPath);
    controller = new AthenaController(new AthenaService(db));
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

  it('answers with the practice name', async () => {
    const { response, body } = jsonCapture();

    await controller.getOrganization(response, '12345');

    expect(body()).toEqual({ name: 'Sunrise Family Medicine' });
  });

  it('answers null for an unknown practice', async () => {
    const { response, body } = jsonCapture();

    await controller.getOrganization(response, '99999');

    expect(body()).toEqual({ name: null });
  });
});
