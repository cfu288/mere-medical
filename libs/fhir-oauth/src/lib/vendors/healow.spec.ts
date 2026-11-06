import { createHealowClientConfidential } from './healow';
import type { HealowTokenSet } from './healow';

const tokens: HealowTokenSet = {
  accessToken: 'old',
  refreshToken: 'r',
  idToken: 'id',
  expiresAt: 0,
  tenantId: 'clinic-1',
  raw: {},
};

describe('createHealowClientConfidential headers', () => {
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ access_token: 'new', expires_in: 3600 }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  it('reads the extra headers on every refresh', async () => {
    let key = 'first-registration-token';
    const client = createHealowClientConfidential({
      token: 'https://mere.example/api/v1/healow/token',
      refresh: 'https://mere.example/api/v1/healow/refresh',
      headers: () => ({ 'X-Registration-Token': key }),
    });

    await client.refresh(tokens, {} as never);
    key = 'second-registration-token';
    await client.refresh(tokens, {} as never);

    expect(fetchMock.mock.calls[0][1].headers).toEqual({
      'Content-Type': 'application/json',
      'X-Registration-Token': 'first-registration-token',
    });
    expect(fetchMock.mock.calls[1][1].headers).toEqual({
      'Content-Type': 'application/json',
      'X-Registration-Token': 'second-registration-token',
    });
  });

  it('sends the extra headers on the callback exchange', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        access_token: 'new',
        id_token: 'id',
        expires_in: 3600,
      }),
    });
    const client = createHealowClientConfidential({
      token: 'https://mere.example/api/v1/healow/token',
      refresh: 'https://mere.example/api/v1/healow/refresh',
      headers: () => ({ 'X-Registration-Token': 'valid-registration-token' }),
    });

    const result = await client.handleCallback(
      new URLSearchParams({ code: 'abc', state: 's1' }),
      {
        redirectUri: 'https://mere.example/healow/callback',
        tenant: { id: 'clinic-1' },
      } as never,
      { codeVerifier: 'v', state: 's1', startedAt: 0 },
    );

    expect(fetchMock).toHaveBeenCalledWith(
      'https://mere.example/api/v1/healow/token',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Registration-Token': 'valid-registration-token',
        },
        body: JSON.stringify({
          code: 'abc',
          redirect_uri: 'https://mere.example/healow/callback',
          code_verifier: 'v',
          tenant_id: 'clinic-1',
        }),
      },
    );
    expect(result.tenantId).toBe('clinic-1');
  });

  it('sends only the content type without extra headers', async () => {
    const client = createHealowClientConfidential({
      token: 'https://mere.example/api/v1/healow/token',
      refresh: 'https://mere.example/api/v1/healow/refresh',
    });

    await client.refresh(tokens, {} as never);

    expect(fetchMock.mock.calls[0][1].headers).toEqual({
      'Content-Type': 'application/json',
    });
  });
});
