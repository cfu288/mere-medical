import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ThrottlerModule } from '@nestjs/throttler';
import request from 'supertest';
import { AthenaController } from './athena.controller';
import { AthenaService } from './athena.service';
import { OriginGuard } from '../proxy/guards/origin.guard';
import { ALLOWED_ORIGIN } from '../proxy/proxy.constants';
import { TENANT_DB } from '../tenant-db/tenant-db.module';
import {
  SeededTenantDb,
  openSeededTenantDb,
} from '../tenant-db/tenant-db.fixture';

describe('AthenaController', () => {
  let app: INestApplication;
  let seeded: SeededTenantDb;

  beforeAll(async () => {
    seeded = await openSeededTenantDb([
      {
        tenantId: '12345',
        vendor: 'athena',
        fhirVersion: 'R4',
        name: 'Sunrise Family Medicine',
        url: 'https://api.platform.athenahealth.com/fhir/r4',
        kind: 'lookup',
      },
    ]);
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ThrottlerModule.forRoot([{ name: 'short', ttl: 1000, limit: 1000 }]),
      ],
      controllers: [AthenaController],
      providers: [
        AthenaService,
        OriginGuard,
        { provide: TENANT_DB, useValue: seeded.db },
        {
          provide: ALLOWED_ORIGIN,
          useValue: {
            status: 'configured',
            value: 'https://app.example.com',
            origin: 'https://app.example.com',
          },
        },
      ],
    }).compile();
    app = module.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    await seeded.close();
  });

  it('answers with the practice name', async () => {
    const response = await request(app.getHttpServer())
      .get('/v1/athena/organizations/12345')
      .set('Origin', 'https://app.example.com');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ name: 'Sunrise Family Medicine' });
  });

  it('answers null for an unknown practice', async () => {
    const response = await request(app.getHttpServer())
      .get('/v1/athena/organizations/99999')
      .set('Origin', 'https://app.example.com');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ name: null });
  });

  it('refuses a request without an allowed origin', async () => {
    const response = await request(app.getHttpServer()).get(
      '/v1/athena/organizations/12345',
    );

    expect(response.status).toBe(403);
  });
});
