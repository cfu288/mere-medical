import { parseServerVendorConfig } from './vendor-config.server';

describe('parseServerVendorConfig', () => {
  const ID = 'abc123';

  it('produces a complete onpatient registration when fully configured', () => {
    const { onpatient } = parseServerVendorConfig({
      ONPATIENT_CLIENT_ID: ID,
      ONPATIENT_CLIENT_SECRET: 'shh',
      PUBLIC_URL: 'https://mere.example',
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

  it('derives healow client mode from the server secret', () => {
    const withSecret = parseServerVendorConfig({
      HEALOW_CLIENT_ID: ID,
      HEALOW_CLIENT_SECRET: 'shh',
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
});
