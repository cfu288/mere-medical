import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { HealowController } from './healow.controller';
import { HealowService } from './healow.service';
import { ConfigService } from '../config/config.service';
import { RegistrationTokenGuard } from '../proxy/guards/registration-token.guard';
import { REGISTRATION_ACCESS } from '../proxy/proxy.constants';
import { TENANT_DB } from '../tenant-db/tenant-db.module';
import {
  SeededTenantDb,
  openSeededTenantDb,
} from '../tenant-db/tenant-db.fixture';

const TOKEN = 'valid-registration-token';
const REJECTED = {
  error: 'registration_token_rejected',
  error_description:
    'Your invite link does not work for this Mere app. Ask your Mere administrator for a new one.',
};

describe('HealowController app key', () => {
  let app: INestApplication;
  let seeded: SeededTenantDb;
  const fetchMock = jest.fn();
  const originalFetch = global.fetch;

  beforeAll(async () => {
    seeded = await openSeededTenantDb([
      {
        tenantId: 'clinic-1',
        vendor: 'healow',
        fhirVersion: 'R4',
        name: 'Sunrise Family Medicine',
        url: 'https://fhir.healow.example/clinic-1',
        token: 'https://oauth.healow.example/clinic-1/token',
        authorize: 'https://oauth.healow.example/clinic-1/authorize',
      },
    ]);
    const module = await Test.createTestingModule({
      controllers: [HealowController],
      providers: [
        HealowService,
        RegistrationTokenGuard,
        { provide: TENANT_DB, useValue: seeded.db },
        {
          provide: REGISTRATION_ACCESS,
          useValue: { mode: 'keyed', token: TOKEN },
        },
        {
          provide: ConfigService,
          useValue: {
            getPublicConfig: () => ({ HEALOW_CLIENT_ID: 'id' }),
            getHealowClientSecret: () => 'shh',
          },
        },
      ],
    }).compile();
    app = module.createNestApplication();
    await app.init();
  });

  beforeEach(() => {
    fetchMock.mockReset().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ access_token: 'vendor-token' }),
    });
    global.fetch = fetchMock;
  });

  afterAll(async () => {
    global.fetch = originalFetch;
    await app.close();
    await seeded.close();
  });

  it('refuses a token exchange without the key before looking anything up', async () => {
    const response = await request(app.getHttpServer())
      .post('/v1/healow/token')
      .send({
        tenant_id: 'clinic-1',
        code: 'abc',
        redirect_uri: 'https://mere.example/cb',
        code_verifier: 'v',
      });

    expect(response.status).toBe(401);
    expect(response.body).toEqual(REJECTED);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('refuses a refresh without the key', async () => {
    const response = await request(app.getHttpServer())
      .post('/v1/healow/refresh')
      .send({ tenant_id: 'clinic-1', refresh_token: 'r' });

    expect(response.status).toBe(401);
    expect(response.body).toEqual(REJECTED);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('exchanges a code when the request carries the key', async () => {
    const response = await request(app.getHttpServer())
      .post('/v1/healow/token')
      .set('X-Registration-Token', TOKEN)
      .send({
        tenant_id: 'clinic-1',
        code: 'abc',
        redirect_uri: 'https://mere.example/cb',
        code_verifier: 'v',
      });

    expect(response.status).toBe(201);
    expect(response.body).toEqual({ access_token: 'vendor-token' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe(
      'https://oauth.healow.example/clinic-1/token',
    );
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe(
      'Basic aWQ6c2ho',
    );
  });

  it('answers tenant lookups without a key', async () => {
    const response = await request(app.getHttpServer()).get(
      '/v1/healow/r4/tenants?query=Sunrise',
    );

    expect(response.status).toBe(200);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
