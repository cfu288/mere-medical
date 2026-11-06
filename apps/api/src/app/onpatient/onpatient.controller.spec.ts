import { INestApplication } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { Test } from '@nestjs/testing';
import { of, throwError } from 'rxjs';
import request from 'supertest';
import { OnPatientController } from './onpatient.controller';
import { OnPatientService } from './onpatient.service';
import { RegistrationTokenGuard } from '../proxy/guards/registration-token.guard';
import { REGISTRATION_ACCESS } from '../proxy/proxy.constants';
import { RegistrationAccess } from '../vendor-config.server';

const TOKEN = 'valid-registration-token';
const REJECTED = {
  error: 'registration_token_rejected',
  error_description:
    'Your invite link does not work for this Mere app. Ask your Mere administrator for a new one.',
};
const TOKENS = { access_token: 'vendor-token', refresh_token: 'r' };

async function createApp(
  access: RegistrationAccess,
  post: jest.Mock,
): Promise<INestApplication> {
  const module = await Test.createTestingModule({
    controllers: [OnPatientController],
    providers: [
      {
        provide: 'CONFIG',
        useValue: {
          clientId: 'id',
          clientSecret: 'shh',
          publicUrl: 'https://mere.example',
        },
      },
      OnPatientService,
      { provide: HttpService, useValue: { post } },
      RegistrationTokenGuard,
      { provide: REGISTRATION_ACCESS, useValue: access },
    ],
  }).compile();
  const app = module.createNestApplication();
  await app.init();
  return app;
}

function sessionOf(location: string): string {
  return new URL(location).searchParams.get('session') ?? '';
}

describe('OnPatientController app key', () => {
  const post = jest.fn();

  beforeEach(() => {
    post.mockReset().mockReturnValue(of({ status: 200, data: TOKENS }));
  });

  describe('on a keyed instance', () => {
    let app: INestApplication;

    beforeAll(async () => {
      app = await createApp({ mode: 'keyed', token: TOKEN }, post);
    });

    afterAll(async () => {
      await app.close();
    });

    it('stores the code on callback without spending the secret', async () => {
      const response = await request(app.getHttpServer()).get(
        '/v1/onpatient/callback?code=abc',
      );

      expect(response.status).toBe(302);
      expect(response.headers.location).toMatch(
        /^https:\/\/mere\.example\/onpatient\/callback\?session=[0-9a-f-]{36}$/,
      );
      expect(post).not.toHaveBeenCalled();
    });

    it('refuses to exchange the session without the key', async () => {
      const callback = await request(app.getHttpServer()).get(
        '/v1/onpatient/callback?code=abc',
      );
      const response = await request(app.getHttpServer()).get(
        `/v1/onpatient/tokens?session=${sessionOf(callback.headers.location)}`,
      );

      expect(response.status).toBe(401);
      expect(response.body).toEqual(REJECTED);
      expect(post).not.toHaveBeenCalled();
    });

    it('exchanges the session once when the request carries the key', async () => {
      const callback = await request(app.getHttpServer()).get(
        '/v1/onpatient/callback?code=abc',
      );
      const session = sessionOf(callback.headers.location);
      const first = await request(app.getHttpServer())
        .get(`/v1/onpatient/tokens?session=${session}`)
        .set('X-Registration-Token', TOKEN);
      const second = await request(app.getHttpServer())
        .get(`/v1/onpatient/tokens?session=${session}`)
        .set('X-Registration-Token', TOKEN);

      expect(first.status).toBe(200);
      expect(first.body).toEqual(TOKENS);
      expect(post).toHaveBeenCalledTimes(1);
      expect(post.mock.calls[0][0]).toBe('https://onpatient.com/o/token/');
      expect(post.mock.calls[0][1]).toBe(
        'grant_type=authorization_code&client_id=id&client_secret=shh&redirect_uri=https%3A%2F%2Fmere.example%2Fapi%2Fv1%2Fonpatient%2Fcallback&code=abc',
      );
      expect(second.status).toBe(401);
      expect(second.body).toEqual({ error: 'Session expired or already used' });
    });

    it('answers 403 when the vendor refuses the code and spends the session', async () => {
      post.mockReturnValue(
        throwError(() => new Error('Request failed with status code 400')),
      );
      const callback = await request(app.getHttpServer()).get(
        '/v1/onpatient/callback?code=expired-code',
      );
      const session = sessionOf(callback.headers.location);
      const first = await request(app.getHttpServer())
        .get(`/v1/onpatient/tokens?session=${session}`)
        .set('X-Registration-Token', TOKEN);
      const second = await request(app.getHttpServer())
        .get(`/v1/onpatient/tokens?session=${session}`)
        .set('X-Registration-Token', TOKEN);

      expect(first.status).toBe(403);
      expect(first.body).toEqual({
        statusCode: 403,
        message: 'Forbidden: unable to get auth token with code',
      });
      expect(post).toHaveBeenCalledTimes(1);
      expect(second.status).toBe(401);
      expect(second.body).toEqual({ error: 'Session expired or already used' });
    });

    it('refuses a callback without a code and stores nothing', async () => {
      const response = await request(app.getHttpServer()).get(
        '/v1/onpatient/callback',
      );

      expect(response.status).toBe(500);
      expect(post).not.toHaveBeenCalled();
    });

    it('forgets a session after 60 seconds', async () => {
      jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] });
      try {
        const callback = await request(app.getHttpServer()).get(
          '/v1/onpatient/callback?code=abc',
        );
        jest.setSystemTime(Date.now() + 61_000);
        const response = await request(app.getHttpServer())
          .get(
            `/v1/onpatient/tokens?session=${sessionOf(callback.headers.location)}`,
          )
          .set('X-Registration-Token', TOKEN);

        expect(response.status).toBe(401);
        expect(post).not.toHaveBeenCalled();
      } finally {
        jest.useRealTimers();
      }
    });

    it('answers 401 for an unknown session', async () => {
      const response = await request(app.getHttpServer())
        .get('/v1/onpatient/tokens?session=nope')
        .set('X-Registration-Token', TOKEN);

      expect(response.status).toBe(401);
      expect(response.body).toEqual({
        error: 'Session expired or already used',
      });
    });
  });

  it('exchanges without a key on an open instance', async () => {
    const app = await createApp({ mode: 'open' }, post);
    const callback = await request(app.getHttpServer()).get(
      '/v1/onpatient/callback?code=abc',
    );
    const response = await request(app.getHttpServer()).get(
      `/v1/onpatient/tokens?session=${sessionOf(callback.headers.location)}`,
    );
    await app.close();

    expect(response.status).toBe(200);
    expect(response.body).toEqual(TOKENS);
  });
});
