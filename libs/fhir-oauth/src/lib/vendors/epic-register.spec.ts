import { registerEpicDynamicClient } from './epic';

const publicKey = { e: 'AQAB', kty: 'RSA', n: 'test-modulus', kid: 'test-kid' };

describe('registerEpicDynamicClient', () => {
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({ client_id: 'registered-client-id' }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  it('posts to the registration url it is given', async () => {
    await registerEpicDynamicClient(
      'access-token',
      'https://call.api.northwell.io/epic-proxy/oauth2/register',
      'software-id',
      publicKey,
    );

    expect(fetchMock).toHaveBeenCalledWith(
      'https://call.api.northwell.io/epic-proxy/oauth2/register',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('posts to a proxy registration url unchanged', async () => {
    await registerEpicDynamicClient(
      'access-token',
      'https://app.example.com/api/proxy?serviceId=abc&target_type=register',
      'software-id',
      publicKey,
    );

    expect(fetchMock).toHaveBeenCalledWith(
      'https://app.example.com/api/proxy?serviceId=abc&target_type=register',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('returns the registered client id', async () => {
    const result = await registerEpicDynamicClient(
      'access-token',
      'https://prd.lluh.org/fhir/oauth2/register',
      'software-id',
      publicKey,
    );

    expect(result).toEqual({ clientId: 'registered-client-id' });
  });

  it('reports dcr_not_supported on 404', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 404,
      text: async () => 'Not Found',
    });

    await expect(
      registerEpicDynamicClient(
        'access-token',
        'https://prd.lluh.org/fhir/oauth2/register',
        'software-id',
        publicKey,
      ),
    ).rejects.toMatchObject({ code: 'dcr_not_supported' });
  });
});
