import type { Response } from 'express';
import { AthenaController } from './athena.controller';
import { AthenaService } from './athena.service';
import {
  SeededTenantDb,
  openSeededTenantDb,
} from '../tenant-db/tenant-db.fixture';

describe('AthenaController', () => {
  let seeded: SeededTenantDb;
  let controller: AthenaController;

  beforeEach(async () => {
    seeded = await openSeededTenantDb([
      {
        tenantId: '12345',
        vendor: 'athena',
        fhirVersion: 'R4',
        name: 'Sunrise Family Medicine',
        url: 'https://api.platform.athenahealth.com/fhir/r4',
        searchable: false,
      },
    ]);
    controller = new AthenaController(new AthenaService(seeded.db));
  });

  afterEach(async () => {
    await seeded.close();
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
