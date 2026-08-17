import {
  parseVendorConfig,
  VendorConfigModel,
  VendorEnv,
} from './vendor-config';

const ID = 'client-id';

describe('parseVendorConfig', () => {
  const cases: [string, VendorEnv, Partial<VendorConfigModel>][] = [
    [
      'empty config disables everything',
      {},
      {
        publicUrl: { status: 'missing' },
        epicR4: {
          status: 'disabled',
          enableWith: {
            anyOf: ['EPIC_CLIENT_ID_R4', 'EPIC_SANDBOX_CLIENT_ID_R4'],
          },
        },
        epicDstu2: {
          status: 'disabled',
          enableWith: {
            anyOf: ['EPIC_CLIENT_ID_DSTU2', 'EPIC_SANDBOX_CLIENT_ID_DSTU2'],
          },
        },
        cerner: {
          status: 'disabled',
          enableWith: { anyOf: ['CERNER_CLIENT_ID'] },
        },
        veradigm: {
          status: 'disabled',
          enableWith: { anyOf: ['VERADIGM_CLIENT_ID'] },
        },
        onpatient: {
          status: 'disabled',
          enableWith: {
            allOf: [
              'ONPATIENT_CLIENT_ID',
              'ONPATIENT_CLIENT_SECRET (on the server)',
              'PUBLIC_URL',
            ],
          },
        },
        va: { status: 'disabled', enableWith: { anyOf: ['VA_CLIENT_ID'] } },
        healow: {
          status: 'disabled',
          enableWith: { anyOf: ['HEALOW_CLIENT_ID'] },
        },
        athena: {
          status: 'disabled',
          enableWith: {
            anyOf: ['ATHENA_CLIENT_ID', 'ATHENA_SANDBOX_CLIENT_ID'],
          },
        },
      },
    ],
    [
      'legacy EPIC_CLIENT_ID enables production for both versions',
      { EPIC_CLIENT_ID: ID },
      {
        epicR4: {
          status: 'production',
          production: { envVar: 'EPIC_CLIENT_ID', value: ID },
        },
        epicDstu2: {
          status: 'production',
          production: { envVar: 'EPIC_CLIENT_ID', value: ID },
        },
      },
    ],
    [
      'version-specific production id wins over the legacy id',
      { EPIC_CLIENT_ID: ID, EPIC_CLIENT_ID_R4: 'r4-id' },
      {
        epicR4: {
          status: 'production',
          production: { envVar: 'EPIC_CLIENT_ID_R4', value: 'r4-id' },
        },
      },
    ],
    [
      'legacy EPIC_SANDBOX_CLIENT_ID enables sandbox-only for both versions',
      { EPIC_SANDBOX_CLIENT_ID: ID },
      {
        epicR4: {
          status: 'sandbox-only',
          sandbox: { envVar: 'EPIC_SANDBOX_CLIENT_ID', value: ID },
        },
        epicDstu2: {
          status: 'sandbox-only',
          sandbox: { envVar: 'EPIC_SANDBOX_CLIENT_ID', value: ID },
        },
      },
    ],
    [
      'production plus sandbox reports production with the sandbox source',
      { EPIC_CLIENT_ID_R4: ID, EPIC_SANDBOX_CLIENT_ID_R4: ID },
      {
        epicR4: {
          status: 'production',
          production: { envVar: 'EPIC_CLIENT_ID_R4', value: ID },
          sandbox: { envVar: 'EPIC_SANDBOX_CLIENT_ID_R4', value: ID },
        },
      },
    ],
    [
      'unsubstituted docker placeholders count as unconfigured',
      {
        EPIC_CLIENT_ID_R4: '$EPIC_CLIENT_ID_R4',
        EPIC_SANDBOX_CLIENT_ID_R4: ID,
      },
      {
        epicR4: {
          status: 'sandbox-only',
          sandbox: { envVar: 'EPIC_SANDBOX_CLIENT_ID_R4', value: ID },
        },
      },
    ],
    [
      'athena sandbox id alone is sandbox-only',
      { ATHENA_SANDBOX_CLIENT_ID: ID },
      {
        athena: {
          status: 'sandbox-only',
          sandbox: { envVar: 'ATHENA_SANDBOX_CLIENT_ID', value: ID },
        },
      },
    ],
    [
      'athena production hides the sandbox id because login never uses it',
      { ATHENA_CLIENT_ID: ID, ATHENA_SANDBOX_CLIENT_ID: ID },
      {
        athena: {
          status: 'production',
          production: { envVar: 'ATHENA_CLIENT_ID', value: ID },
        },
      },
    ],
    [
      'va id is inherently sandbox-only',
      { VA_CLIENT_ID: ID },
      {
        va: {
          status: 'sandbox-only',
          sandbox: { envVar: 'VA_CLIENT_ID', value: ID },
        },
      },
    ],
    [
      'onpatient requires the server secret, not just the client id',
      { ONPATIENT_CLIENT_ID: ID, PUBLIC_URL: 'https://mere.example' },
      {
        onpatient: {
          status: 'disabled',
          enableWith: { allOf: ['ONPATIENT_CLIENT_SECRET (on the server)'] },
        },
      },
    ],
    [
      'onpatient with client id, server secret, and public url is production',
      {
        ONPATIENT_CLIENT_ID: ID,
        ONPATIENT_SECRET_CONFIGURED: true,
        PUBLIC_URL: 'https://mere.example',
      },
      {
        publicUrl: {
          status: 'configured',
          value: 'https://mere.example',
          origin: 'https://mere.example',
        },
        onpatient: {
          status: 'production',
          production: { envVar: 'ONPATIENT_CLIENT_ID', value: ID },
          publicUrl: 'https://mere.example',
        },
      },
    ],
    [
      'onpatient without a public url cannot build its auth flow',
      { ONPATIENT_CLIENT_ID: ID, ONPATIENT_SECRET_CONFIGURED: true },
      {
        onpatient: {
          status: 'disabled',
          enableWith: { allOf: ['PUBLIC_URL'] },
        },
      },
    ],
    [
      'a public url that is not a valid url is rejected, not used',
      {
        ONPATIENT_CLIENT_ID: ID,
        ONPATIENT_SECRET_CONFIGURED: true,
        PUBLIC_URL: 'mereapp.com',
      },
      {
        publicUrl: { status: 'invalid', value: 'mereapp.com' },
        onpatient: {
          status: 'disabled',
          enableWith: { allOf: ['a valid PUBLIC_URL'] },
        },
      },
    ],
    [
      'non-string wire values are treated as unconfigured, not a crash',
      { CERNER_CLIENT_ID: 123, PUBLIC_URL: false } as unknown as VendorEnv,
      {
        publicUrl: { status: 'missing' },
        cerner: {
          status: 'disabled',
          enableWith: { anyOf: ['CERNER_CLIENT_ID'] },
        },
      },
    ],
    [
      'healow reports confidential mode when the server holds a secret',
      { HEALOW_CLIENT_ID: ID, HEALOW_CONFIDENTIAL_MODE: true },
      {
        healow: {
          status: 'production',
          production: { envVar: 'HEALOW_CLIENT_ID', value: ID },
          mode: 'confidential',
        },
      },
    ],
    [
      'healow without a server secret is a public client',
      { HEALOW_CLIENT_ID: ID },
      {
        healow: {
          status: 'production',
          production: { envVar: 'HEALOW_CLIENT_ID', value: ID },
          mode: 'public',
        },
      },
    ],
  ];

  it.each(cases)('%s', (_name, config, expected) => {
    const model = parseVendorConfig(config);
    for (const [key, channel] of Object.entries(expected)) {
      expect(model[key as keyof VendorConfigModel]).toEqual(channel);
    }
  });
});
