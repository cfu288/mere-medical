import { parseServerVendorConfig } from './vendor-config.server';

describe('parseServerVendorConfig', () => {
  const ID = 'abc123';
  const KEY = 'valid-app-key-for-the-test-suite';
  const TOKEN = '3ebnq9Avix4S-QZ4rLC47V-crei4F3IT7PqAOFSlCeA';

  it('produces a complete onpatient registration when fully configured', () => {
    const { onpatient } = parseServerVendorConfig({
      ONPATIENT_CLIENT_ID: ID,
      ONPATIENT_CLIENT_SECRET: 'shh',
      PUBLIC_URL: 'https://mere.example',
      APP_KEY: KEY,
    });
    expect(onpatient).toEqual({
      status: 'production',
      registration: {
        clientId: ID,
        clientSecret: 'shh',
        publicUrl: 'https://mere.example',
      },
    });
  });

  it('disables onpatient and names every missing variable', () => {
    const { onpatient } = parseServerVendorConfig({
      ONPATIENT_CLIENT_ID: ID,
    });
    expect(onpatient).toEqual({
      status: 'disabled',
      enableWith: { allOf: ['ONPATIENT_CLIENT_SECRET', 'PUBLIC_URL'] },
    });
  });

  it('treats an unsubstituted PUBLIC_URL placeholder as missing', () => {
    const { onpatient } = parseServerVendorConfig({
      ONPATIENT_CLIENT_ID: ID,
      ONPATIENT_CLIENT_SECRET: 'shh',
      PUBLIC_URL: '$PUBLIC_URL',
    });
    expect(onpatient).toEqual({
      status: 'disabled',
      enableWith: { allOf: ['PUBLIC_URL'] },
    });
  });

  it('agrees with the shared model when PUBLIC_URL is not a valid URL', () => {
    const { onpatient, publicUrl } = parseServerVendorConfig({
      ONPATIENT_CLIENT_ID: ID,
      ONPATIENT_CLIENT_SECRET: 'shh',
      PUBLIC_URL: 'mereapp.com',
    });
    expect(publicUrl).toEqual({ status: 'invalid', value: 'mereapp.com' });
    expect(onpatient).toEqual({
      status: 'disabled',
      enableWith: { allOf: ['a valid PUBLIC_URL'] },
    });
  });

  it('produces a nextgen registration only when the secret is present', () => {
    const withSecret = parseServerVendorConfig({
      NEXTGEN_CLIENT_ID: ID,
      NEXTGEN_CLIENT_SECRET: 'shh',
      APP_KEY: KEY,
    });
    expect(withSecret.nextgen).toEqual({
      status: 'production',
      registration: { clientId: ID, clientSecret: 'shh' },
    });

    const withoutSecret = parseServerVendorConfig({ NEXTGEN_CLIENT_ID: ID });
    expect(withoutSecret.nextgen).toEqual({
      status: 'disabled',
      enableWith: { allOf: ['NEXTGEN_CLIENT_SECRET'] },
    });
  });

  it('treats an unsubstituted nextgen secret placeholder as missing', () => {
    const { nextgen } = parseServerVendorConfig({
      NEXTGEN_CLIENT_ID: ID,
      NEXTGEN_CLIENT_SECRET: '$NEXTGEN_CLIENT_SECRET',
    });
    expect(nextgen).toEqual({
      status: 'disabled',
      enableWith: { allOf: ['NEXTGEN_CLIENT_SECRET'] },
    });
  });

  it('derives healow client mode from the server secret', () => {
    const withSecret = parseServerVendorConfig({
      HEALOW_CLIENT_ID: ID,
      HEALOW_CLIENT_SECRET: 'shh',
      APP_KEY: KEY,
    });
    expect(withSecret.healow).toMatchObject({
      status: 'production',
      mode: 'confidential',
    });

    const withoutSecret = parseServerVendorConfig({ HEALOW_CLIENT_ID: ID });
    expect(withoutSecret.healow).toMatchObject({
      status: 'production',
      mode: 'public',
    });
  });

  describe('registrationAccess', () => {
    const nextgen = { NEXTGEN_CLIENT_ID: ID, NEXTGEN_CLIENT_SECRET: 'shh' };

    it('is open when no confidential client is configured, whatever the key variables say', () => {
      expect(
        parseServerVendorConfig({
          EPIC_CLIENT_ID_R4: ID,
          APP_KEY: KEY,
          ALLOW_PUBLIC_CONFIDENTIAL_CLIENTS: 'true',
        }).registrationAccess,
      ).toEqual({ mode: 'open' });
    });

    it.each([
      ['a secret without its client id', { NEXTGEN_CLIENT_SECRET: 'shh' }],
      [
        'onpatient without PUBLIC_URL',
        { ONPATIENT_CLIENT_ID: ID, ONPATIENT_CLIENT_SECRET: 'shh' },
      ],
      ['healow in public mode', { HEALOW_CLIENT_ID: ID }],
    ])('is open for %s', (_name, env) => {
      expect(parseServerVendorConfig(env).registrationAccess).toEqual({
        mode: 'open',
      });
    });

    it('is keyed with the token signed by the trimmed key', () => {
      expect(
        parseServerVendorConfig({ ...nextgen, APP_KEY: ` ${KEY} ` })
          .registrationAccess,
      ).toEqual({ mode: 'keyed', token: TOKEN });
    });

    it('carries the trimmed contact when APP_CONTACT is set', () => {
      expect(
        parseServerVendorConfig({
          ...nextgen,
          APP_KEY: KEY,
          APP_CONTACT: ' admin@mere.example ',
        }).registrationAccess,
      ).toEqual({ mode: 'keyed', token: TOKEN, contact: 'admin@mere.example' });
    });

    it('carries no contact when APP_CONTACT is blank', () => {
      expect(
        parseServerVendorConfig({
          ...nextgen,
          APP_KEY: KEY,
          APP_CONTACT: '  ',
        }).registrationAccess,
      ).toEqual({ mode: 'keyed', token: TOKEN });
    });

    it('is keyed for a healow-only confidential deployment', () => {
      expect(
        parseServerVendorConfig({
          HEALOW_CLIENT_ID: ID,
          HEALOW_CLIENT_SECRET: 'shh',
          APP_KEY: KEY,
        }).registrationAccess,
      ).toEqual({ mode: 'keyed', token: TOKEN });
    });

    it.each([['true'], [' TRUE ']])(
      'is public when the opt-out is %j',
      (value) => {
        expect(
          parseServerVendorConfig({
            ...nextgen,
            ALLOW_PUBLIC_CONFIDENTIAL_CLIENTS: value,
          }).registrationAccess,
        ).toEqual({ mode: 'public' });
      },
    );

    it('is keyed when both variables are set', () => {
      expect(
        parseServerVendorConfig({
          ...nextgen,
          APP_KEY: KEY,
          ALLOW_PUBLIC_CONFIDENTIAL_CLIENTS: 'true',
        }).registrationAccess,
      ).toEqual({ mode: 'keyed', token: TOKEN });
    });

    it('refuses to start with instructions when neither variable is set', () => {
      expect(() => parseServerVendorConfig(nextgen)).toThrow(
        'A Healow, NextGen, or OnPatient client secret is configured, so this instance requires APP_KEY.\nGenerate a key with: docker compose run --rm app generate-app-key\n  or, in a source checkout: npm run generate-app-key\nSet APP_KEY to that value and recreate the container.\nThen print the invite link with: docker compose run --rm app generate-invite-link\n  or, in a source checkout: npm run generate-invite-link\nShare that link with the people who use this instance.\nTo run a public instance instead, set ALLOW_PUBLIC_CONFIDENTIAL_CLIENTS=true.\nDocs: https://meremedical.co/docs/getting-started/docker#app-key',
      );
    });

    it.each([
      ['a placeholder key', '$APP_KEY', 'this instance requires APP_KEY'],
      ['an empty key', '  ', 'this instance requires APP_KEY'],
      [
        'a short key',
        '0123456789abcdef0123456789abcde',
        'APP_KEY must be the 32 characters that generate-app-key prints (letters, digits, - and _).\nGenerate one with: docker compose run --rm app generate-app-key\nDocs: https://meremedical.co/docs/getting-started/docker#app-key',
      ],
      [
        'a long key',
        '0123456789abcdef0123456789abcdef0',
        'APP_KEY must be the 32 characters that generate-app-key prints (letters, digits, - and _).\nGenerate one with: docker compose run --rm app generate-app-key\nDocs: https://meremedical.co/docs/getting-started/docker#app-key',
      ],
      [
        'a passphrase of the right length',
        'correct horse battery staple 123',
        'APP_KEY must be the 32 characters that generate-app-key prints (letters, digits, - and _).\nGenerate one with: docker compose run --rm app generate-app-key\nDocs: https://meremedical.co/docs/getting-started/docker#app-key',
      ],
      [
        'a key with a false opt-out beside it',
        '0123456789abcdef0123456789abcde',
        'APP_KEY must be the 32 characters that generate-app-key prints (letters, digits, - and _).\nGenerate one with: docker compose run --rm app generate-app-key\nDocs: https://meremedical.co/docs/getting-started/docker#app-key',
      ],
    ])('refuses %s', (_name, key, message) => {
      expect(() =>
        parseServerVendorConfig({
          ...nextgen,
          APP_KEY: key,
          ALLOW_PUBLIC_CONFIDENTIAL_CLIENTS: 'false',
        }),
      ).toThrow(message);
    });
  });
});
