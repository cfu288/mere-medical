import { AppConfig } from './AppConfigProvider';

export function isConfigured(value: string | undefined): value is string {
  return !!value && !value.startsWith('$');
}

export interface CredentialSource {
  envVar: string;
  value: string;
}

export type VendorChannel =
  | { status: 'disabled'; enableWith: string[] }
  | { status: 'sandbox-only'; sandbox: CredentialSource }
  | {
      status: 'production';
      production: CredentialSource;
      sandbox?: CredentialSource;
    };

export interface VendorConfigModel {
  epicR4: VendorChannel;
  epicDstu2: VendorChannel;
  cerner: VendorChannel;
  veradigm: VendorChannel;
  onpatient: VendorChannel;
  va: VendorChannel;
  healow: VendorChannel;
  athena: VendorChannel;
}

function credential(
  config: AppConfig,
  ...envVars: (keyof AppConfig & string)[]
): CredentialSource | undefined {
  for (const envVar of envVars) {
    const value = config[envVar];
    if (typeof value === 'string' && isConfigured(value)) {
      return { envVar, value };
    }
  }
  return undefined;
}

function channel(
  production: CredentialSource | undefined,
  sandbox: CredentialSource | undefined,
  enableWith: string[],
): VendorChannel {
  if (production) {
    return { status: 'production', production, sandbox };
  }
  if (sandbox) {
    return { status: 'sandbox-only', sandbox };
  }
  return { status: 'disabled', enableWith };
}

export function parseVendorConfig(config: AppConfig): VendorConfigModel {
  return {
    epicR4: channel(
      credential(config, 'EPIC_CLIENT_ID_R4', 'EPIC_CLIENT_ID'),
      credential(config, 'EPIC_SANDBOX_CLIENT_ID_R4', 'EPIC_SANDBOX_CLIENT_ID'),
      ['EPIC_CLIENT_ID_R4', 'EPIC_SANDBOX_CLIENT_ID_R4'],
    ),
    epicDstu2: channel(
      credential(config, 'EPIC_CLIENT_ID_DSTU2', 'EPIC_CLIENT_ID'),
      credential(
        config,
        'EPIC_SANDBOX_CLIENT_ID_DSTU2',
        'EPIC_SANDBOX_CLIENT_ID',
      ),
      ['EPIC_CLIENT_ID_DSTU2', 'EPIC_SANDBOX_CLIENT_ID_DSTU2'],
    ),
    cerner: channel(credential(config, 'CERNER_CLIENT_ID'), undefined, [
      'CERNER_CLIENT_ID',
    ]),
    veradigm: channel(credential(config, 'VERADIGM_CLIENT_ID'), undefined, [
      'VERADIGM_CLIENT_ID',
    ]),
    onpatient: channel(credential(config, 'ONPATIENT_CLIENT_ID'), undefined, [
      'ONPATIENT_CLIENT_ID',
    ]),
    // The VA integration only supports their sandbox environment
    va: channel(undefined, credential(config, 'VA_CLIENT_ID'), [
      'VA_CLIENT_ID',
    ]),
    healow: channel(credential(config, 'HEALOW_CLIENT_ID'), undefined, [
      'HEALOW_CLIENT_ID',
    ]),
    athena: channel(
      credential(config, 'ATHENA_CLIENT_ID'),
      credential(config, 'ATHENA_SANDBOX_CLIENT_ID'),
      ['ATHENA_CLIENT_ID', 'ATHENA_SANDBOX_CLIENT_ID'],
    ),
  };
}

export interface VendorStatusEntry {
  label: string;
  channel: VendorChannel;
  note?: string;
}

export function vendorStatusEntries(
  model: VendorConfigModel,
  config: AppConfig,
): VendorStatusEntry[] {
  return [
    { label: 'MyChart (Epic, R4)', channel: model.epicR4 },
    { label: 'MyChart Legacy (Epic, DSTU2)', channel: model.epicDstu2 },
    { label: 'Cerner', channel: model.cerner },
    { label: 'Allscripts (Veradigm)', channel: model.veradigm },
    {
      label: 'OnPatient',
      channel: model.onpatient,
      note: 'Also requires ONPATIENT_CLIENT_SECRET on the server and the use proxy setting',
    },
    { label: 'Veterans Affairs', channel: model.va },
    {
      label: 'Healow (eClinicalWorks)',
      channel: model.healow,
      note: config.HEALOW_CONFIDENTIAL_MODE
        ? 'Confidential mode (HEALOW_CLIENT_SECRET is set on the server)'
        : undefined,
    },
    { label: 'Athena Health', channel: model.athena },
  ];
}
