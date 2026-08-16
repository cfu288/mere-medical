import {
  parseVendorConfig,
  VendorConfigModel,
  VendorEnv,
} from './vendor-config';

const ID = 'client-id';

describe('parseVendorConfig', () => {
  const cases: [
    string,
    VendorEnv,
    Partial<{
      [K in keyof VendorConfigModel]: {
        status: VendorConfigModel[K]['status'];
        via?: string;
        sandboxVia?: string;
      };
    }>,
  ][] = [
    [
      'empty config disables everything',
      {},
      {
        epicR4: { status: 'disabled' },
        epicDstu2: { status: 'disabled' },
        cerner: { status: 'disabled' },
        veradigm: { status: 'disabled' },
        onpatient: { status: 'disabled' },
        va: { status: 'disabled' },
        healow: { status: 'disabled' },
        athena: { status: 'disabled' },
      },
    ],
    [
      'legacy EPIC_CLIENT_ID enables production for both versions',
      { EPIC_CLIENT_ID: ID },
      {
        epicR4: { status: 'production', via: 'EPIC_CLIENT_ID' },
        epicDstu2: { status: 'production', via: 'EPIC_CLIENT_ID' },
      },
    ],
    [
      'version-specific production id wins over the legacy id',
      { EPIC_CLIENT_ID: ID, EPIC_CLIENT_ID_R4: 'r4-id' },
      { epicR4: { status: 'production', via: 'EPIC_CLIENT_ID_R4' } },
    ],
    [
      'legacy EPIC_SANDBOX_CLIENT_ID enables sandbox-only for both versions',
      { EPIC_SANDBOX_CLIENT_ID: ID },
      {
        epicR4: {
          status: 'sandbox-only',
          sandboxVia: 'EPIC_SANDBOX_CLIENT_ID',
        },
        epicDstu2: {
          status: 'sandbox-only',
          sandboxVia: 'EPIC_SANDBOX_CLIENT_ID',
        },
      },
    ],
    [
      'production plus sandbox reports production with the sandbox source',
      { EPIC_CLIENT_ID_R4: ID, EPIC_SANDBOX_CLIENT_ID_R4: ID },
      {
        epicR4: {
          status: 'production',
          via: 'EPIC_CLIENT_ID_R4',
          sandboxVia: 'EPIC_SANDBOX_CLIENT_ID_R4',
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
          sandboxVia: 'EPIC_SANDBOX_CLIENT_ID_R4',
        },
      },
    ],
    [
      'athena sandbox id alone is sandbox-only',
      { ATHENA_SANDBOX_CLIENT_ID: ID },
      {
        athena: {
          status: 'sandbox-only',
          sandboxVia: 'ATHENA_SANDBOX_CLIENT_ID',
        },
      },
    ],
    [
      'athena production hides the sandbox id because login never uses it',
      { ATHENA_CLIENT_ID: ID, ATHENA_SANDBOX_CLIENT_ID: ID },
      {
        athena: {
          status: 'production',
          via: 'ATHENA_CLIENT_ID',
          sandboxVia: undefined,
        },
      },
    ],
    [
      'va id is inherently sandbox-only',
      { VA_CLIENT_ID: ID },
      { va: { status: 'sandbox-only', sandboxVia: 'VA_CLIENT_ID' } },
    ],
    [
      'onpatient requires the server secret, not just the client id',
      { ONPATIENT_CLIENT_ID: ID },
      { onpatient: { status: 'disabled' } },
    ],
    [
      'onpatient with client id and server secret is production',
      { ONPATIENT_CLIENT_ID: ID, ONPATIENT_SECRET_CONFIGURED: true },
      { onpatient: { status: 'production', via: 'ONPATIENT_CLIENT_ID' } },
    ],
  ];

  it.each(cases)('%s', (_name, config, expected) => {
    const model = parseVendorConfig(config);
    for (const [key, expectation] of Object.entries(expected)) {
      const channel = model[key as keyof VendorConfigModel];
      expect(channel.status).toBe(expectation.status);
      if ('via' in expectation) {
        expect(
          channel.status === 'production' ? channel.production : undefined,
        ).toBe(expectation.via);
      }
      if ('sandboxVia' in expectation) {
        expect(
          channel.status === 'disabled' ? undefined : channel.sandbox,
        ).toBe(expectation.sandboxVia);
      }
    }
  });

  it('reports what enables a disabled channel', () => {
    const model = parseVendorConfig({});
    expect(
      model.epicR4.status === 'disabled' ? model.epicR4.enableWith : [],
    ).toEqual(['EPIC_CLIENT_ID_R4', 'EPIC_SANDBOX_CLIENT_ID_R4']);
    expect(
      model.onpatient.status === 'disabled' ? model.onpatient.enableWith : [],
    ).toEqual([
      'ONPATIENT_CLIENT_ID and ONPATIENT_CLIENT_SECRET (on the server)',
    ]);
  });
});
