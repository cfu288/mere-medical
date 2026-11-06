import {
  buildNextGenOAuthConfig,
  createNextGenClientConfidential,
} from './nextgen';
import type { NextGenTokenSet } from './nextgen';

describe('buildNextGenOAuthConfig', () => {
  it('builds the callback from a public url without a trailing slash', () => {
    const config = buildNextGenOAuthConfig({
      clientId: 'client-id',
      publicUrl: 'https://mere.example',
      redirectPath: '/nextgen/callback',
    });

    expect(config.redirectUri).toEqual('https://mere.example/nextgen/callback');
  });

  it('builds the callback from a public url with a trailing slash', () => {
    const config = buildNextGenOAuthConfig({
      clientId: 'client-id',
      publicUrl: 'https://mere.example/',
      redirectPath: '/nextgen/callback',
    });

    expect(config.redirectUri).toEqual('https://mere.example/nextgen/callback');
  });

  it('requests no scopes because they are registered in the portal', () => {
    const config = buildNextGenOAuthConfig({
      clientId: 'client-id',
      publicUrl: 'https://mere.example',
      redirectPath: '/nextgen/callback',
    });

    expect(config.scopes).toEqual([]);
  });
});

describe('createNextGenClientConfidential headers', () => {
  const tokens: NextGenTokenSet = {
    accessToken: 'old',
    refreshToken: 'r',
    expiresAt: 0,
    patientId: 'p1',
    raw: {},
  };
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ access_token: 'new', expires_in: 3600 }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  it('sends the extra headers on the callback exchange', async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ access_token: 'new', expires_in: 3600 }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ resourceType: 'Patient', id: 'p1' }),
      });
    const client = createNextGenClientConfidential({
      token: 'https://mere.example/api/v1/nextgen/token',
      refresh: 'https://mere.example/api/v1/nextgen/refresh',
      headers: () => ({ 'X-Registration-Token': 'valid-registration-token' }),
    });

    const result = await client.handleCallback(
      new URLSearchParams({ code: 'abc', state: 's1' }),
      { redirectUri: 'https://mere.example/nextgen/callback' } as never,
      { codeVerifier: 'v', state: 's1', startedAt: 0 },
    );

    expect(fetchMock.mock.calls[0]).toEqual([
      'https://mere.example/api/v1/nextgen/token',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Registration-Token': 'valid-registration-token',
        },
        body: JSON.stringify({
          code: 'abc',
          redirect_uri: 'https://mere.example/nextgen/callback',
        }),
      },
    ]);
    expect(result.patientId).toBe('p1');
  });

  it('sends the extra headers on a refresh', async () => {
    const client = createNextGenClientConfidential({
      token: 'https://mere.example/api/v1/nextgen/token',
      refresh: 'https://mere.example/api/v1/nextgen/refresh',
      headers: () => ({ 'X-Registration-Token': 'valid-registration-token' }),
    });

    await client.refresh(tokens, {} as never);

    expect(fetchMock).toHaveBeenCalledWith(
      'https://mere.example/api/v1/nextgen/refresh',
      expect.objectContaining({
        headers: {
          'Content-Type': 'application/json',
          'X-Registration-Token': 'valid-registration-token',
        },
      }),
    );
  });
});
