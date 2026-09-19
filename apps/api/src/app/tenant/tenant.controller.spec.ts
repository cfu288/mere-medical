import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { TenantController } from './tenant.controller';
import { TenantService } from './tenant.service';
import { TENANT_DB } from '../tenant-db/tenant-db.module';
import {
  SeededTenantDb,
  openSeededTenantDb,
} from '../tenant-db/tenant-db.fixture';

describe('TenantController', () => {
  let app: INestApplication;
  let seeded: SeededTenantDb;

  beforeAll(async () => {
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
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TenantController],
      providers: [TenantService, { provide: TENANT_DB, useValue: seeded.db }],
    }).compile();
    app = module.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    await seeded.close();
  });

  it('answers an R4 search with the vendor and version on each entry', async () => {
    const response = await request(app.getHttpServer()).get(
      '/v1/r4/tenants?query=mercy',
    );

    expect(response.status).toBe(200);
    expect(response.body).toEqual([
      {
        id: 'epic-1',
        url: 'https://epic.example.org/api/FHIR/R4/',
        name: 'Mercy Health',
        token: 'https://epic.example.org/oauth2/token',
        authorize: 'https://epic.example.org/oauth2/authorize',
        vendor: 'EPIC',
        version: 'R4',
      },
    ]);
  });

  it('answers a DSTU2 search with only DSTU2 tenants', async () => {
    const response = await request(app.getHttpServer()).get(
      '/v1/dstu2/tenants?query=mercy',
    );

    expect(response.status).toBe(200);
    expect(response.body).toEqual([
      {
        id: 'cerner-1',
        url: 'https://cerner.example.org/dstu2/',
        name: 'Mercy Clinic',
        token: 'https://cerner.example.org/token',
        authorize: 'https://cerner.example.org/authorize',
        vendor: 'CERNER',
        version: 'DSTU2',
      },
    ]);
  });

  it('answers an empty query with the browse list', async () => {
    const response = await request(app.getHttpServer()).get(
      '/v1/r4/tenants?query=',
    );

    expect(response.status).toBe(200);
    expect(response.body).toEqual([
      {
        id: 'epic-1',
        url: 'https://epic.example.org/api/FHIR/R4/',
        name: 'Mercy Health',
        token: 'https://epic.example.org/oauth2/token',
        authorize: 'https://epic.example.org/oauth2/authorize',
        vendor: 'EPIC',
        version: 'R4',
      },
    ]);
  });
});
