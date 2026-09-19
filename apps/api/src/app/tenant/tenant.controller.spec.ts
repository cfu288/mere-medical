import type { Response } from 'express';
import { TenantController } from './tenant.controller';
import { TenantService } from './tenant.service';
import {
  SeededTenantDb,
  openSeededTenantDb,
} from '../tenant-db/tenant-db.fixture';

describe('TenantController', () => {
  let seeded: SeededTenantDb;
  let controller: TenantController;

  beforeEach(async () => {
    seeded = await openSeededTenantDb([
      {
        tenantId: 'epic-1',
        vendor: 'epic',
        fhirVersion: 'R4',
        name: 'Mercy Health',
        url: 'https://epic.example.org/api/FHIR/R4/',
        token: 'https://epic.example.org/oauth2/token',
        authorize: 'https://epic.example.org/oauth2/authorize',
      },
      {
        tenantId: 'cerner-1',
        vendor: 'cerner',
        fhirVersion: 'DSTU2',
        name: 'Mercy Clinic',
        url: 'https://cerner.example.org/dstu2/',
        token: 'https://cerner.example.org/token',
        authorize: 'https://cerner.example.org/authorize',
      },
    ]);
    controller = new TenantController(new TenantService(seeded.db));
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
