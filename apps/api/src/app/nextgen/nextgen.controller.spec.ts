import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { NextGenController } from './nextgen.controller';
import { RegistrationTokenGuard } from '../proxy/guards/registration-token.guard';
import { REGISTRATION_ACCESS } from '../proxy/proxy.constants';
import { RegistrationAccess } from '../vendor-config.server';

const TOKEN = 'valid-registration-token';
const REJECTED = {
  error: 'registration_token_rejected',
  error_description:
    'Your invite link does not work for this Mere app. Ask your Mere administrator for a new one.',
};

async function createApp(
  access: RegistrationAccess,
): Promise<INestApplication> {
  const module = await Test.createTestingModule({
    controllers: [NextGenController],
    providers: [
      { provide: 'CONFIG', useValue: { clientId: 'id', clientSecret: 'shh' } },
      RegistrationTokenGuard,
      { provide: REGISTRATION_ACCESS, useValue: access },
    ],
  }).compile();
  const app = module.createNestApplication();
  await app.init();
  return app;
}

describe('NextGenController app key', () => {
  const fetchMock = jest.fn();
  const originalFetch = global.fetch;

  beforeEach(() => {
    fetchMock.mockReset().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ access_token: 'vendor-token' }),
    });
    global.fetch = fetchMock;
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  describe('on a keyed instance', () => {
    let app: INestApplication;

    beforeAll(async () => {
      app = await createApp({ mode: 'keyed', token: TOKEN });
    });

    afterAll(async () => {
      await app.close();
    });

    it.each([
      ['no key', undefined],
      ['a wrong key of the same length', 'wrong-registration-token'],
      ['a wrong key of another length', 'wrong'],
    ])('refuses a token exchange with %s', async (_name, header) => {
      const req = request(app.getHttpServer())
        .post('/v1/nextgen/token')
        .send({ code: 'abc', redirect_uri: 'https://mere.example/cb' });
      const response = await (header
        ? req.set('X-Registration-Token', header)
        : req);

      expect(response.status).toBe(401);
      expect(response.body).toEqual(REJECTED);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('refuses a refresh without the key', async () => {
      const response = await request(app.getHttpServer())
        .post('/v1/nextgen/refresh')
        .send({ refresh_token: 'r' });

      expect(response.status).toBe(401);
      expect(response.body).toEqual(REJECTED);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('exchanges a code when the request carries the key', async () => {
      const response = await request(app.getHttpServer())
        .post('/v1/nextgen/token')
        .set('x-registration-token', TOKEN)
        .send({ code: 'abc', redirect_uri: 'https://mere.example/cb' });

      expect(response.status).toBe(201);
      expect(response.body).toEqual({ access_token: 'vendor-token' });
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock.mock.calls[0][1].body).toBe(
        'grant_type=authorization_code&code=abc&redirect_uri=https%3A%2F%2Fmere.example%2Fcb&client_id=id&client_secret=shh',
      );
    });

    it('refreshes when the request carries the key', async () => {
      const response = await request(app.getHttpServer())
        .post('/v1/nextgen/refresh')
        .set('X-Registration-Token', TOKEN)
        .send({ refresh_token: 'r' });

      expect(response.status).toBe(201);
      expect(fetchMock.mock.calls[0][1].body).toBe(
        'grant_type=refresh_token&refresh_token=r&client_id=id&client_secret=shh',
      );
    });
  });

  it.each([
    ['open', { mode: 'open' } as const],
    ['public', { mode: 'public' } as const],
  ])(
    'answers a request without a key on an %s instance',
    async (_name, access) => {
      const app = await createApp(access);
      const response = await request(app.getHttpServer())
        .post('/v1/nextgen/token')
        .send({ code: 'abc', redirect_uri: 'https://mere.example/cb' });
      await app.close();

      expect(response.status).toBe(201);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    },
  );
});
