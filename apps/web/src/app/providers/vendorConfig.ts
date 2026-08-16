import { AppConfig } from './AppConfigProvider';

export function isConfigured(value: string | undefined): value is string {
  return !!value && !value.startsWith('$');
}

export type VendorChannel =
  | { status: 'disabled'; enableWith: string[] }
  | { status: 'sandbox-only'; sandbox: string }
  | { status: 'production'; production: string; sandbox?: string };

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
): string | undefined {
  for (const envVar of envVars) {
    const value = config[envVar];
    if (typeof value === 'string' && isConfigured(value)) {
      return envVar;
    }
  }
  return undefined;
}

function channel(
  production: string | undefined,
  sandbox: string | undefined,
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

function onPatientChannel(config: AppConfig): VendorChannel {
  const clientId = credential(config, 'ONPATIENT_CLIENT_ID');
  const hasSecret = !!config.ONPATIENT_SECRET_CONFIGURED;
  if (clientId && hasSecret) {
    return { status: 'production', production: clientId };
  }
  const missing = [
    ...(clientId ? [] : ['ONPATIENT_CLIENT_ID']),
    ...(hasSecret ? [] : ['ONPATIENT_CLIENT_SECRET (on the server)']),
  ];
  return { status: 'disabled', enableWith: [missing.join(' and ')] };
}

function athenaChannel(config: AppConfig): VendorChannel {
  const production = credential(config, 'ATHENA_CLIENT_ID');
  const sandbox = credential(config, 'ATHENA_SANDBOX_CLIENT_ID');
  // athena login always uses production when configured, making a sandbox id unreachable alongside it
  if (production) {
    return { status: 'production', production };
  }
  return channel(undefined, sandbox, [
    'ATHENA_CLIENT_ID',
    'ATHENA_SANDBOX_CLIENT_ID',
  ]);
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
    onpatient: onPatientChannel(config),
    // The VA integration only supports their sandbox environment
    va: channel(undefined, credential(config, 'VA_CLIENT_ID'), [
      'VA_CLIENT_ID',
    ]),
    healow: channel(credential(config, 'HEALOW_CLIENT_ID'), undefined, [
      'HEALOW_CLIENT_ID',
    ]),
    athena: athenaChannel(config),
  };
}

export interface VendorStatusEntry {
  label: string;
  channel: VendorChannel;
  note?: string;
}

export function vendorStatusEntries(
  model: VendorConfigModel,
  options: { healowConfidentialMode?: boolean } = {},
): VendorStatusEntry[] {
  return [
    { label: 'MyChart (Epic, R4)', channel: model.epicR4 },
    { label: 'MyChart Legacy (Epic, DSTU2)', channel: model.epicDstu2 },
    { label: 'Cerner', channel: model.cerner },
    { label: 'Allscripts (Veradigm)', channel: model.veradigm },
    {
      label: 'OnPatient',
      channel: model.onpatient,
      note: 'Also requires the use proxy setting',
    },
    { label: 'Veterans Affairs', channel: model.va },
    {
      label: 'Healow (eClinicalWorks)',
      channel: model.healow,
      note: options.healowConfidentialMode
        ? 'Confidential mode (HEALOW_CLIENT_SECRET is set on the server)'
        : undefined,
    },
    { label: 'Athena Health', channel: model.athena },
  ];
}
