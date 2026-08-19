import { buildNextGenOAuthConfig } from './nextgen';

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
