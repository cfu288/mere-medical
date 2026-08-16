export interface VendorEnv {
  EPIC_CLIENT_ID?: string;
  EPIC_CLIENT_ID_DSTU2?: string;
  EPIC_CLIENT_ID_R4?: string;
  EPIC_SANDBOX_CLIENT_ID?: string;
  EPIC_SANDBOX_CLIENT_ID_DSTU2?: string;
  EPIC_SANDBOX_CLIENT_ID_R4?: string;
  CERNER_CLIENT_ID?: string;
  VERADIGM_CLIENT_ID?: string;
  ONPATIENT_CLIENT_ID?: string;
  ONPATIENT_SECRET_CONFIGURED?: boolean;
  VA_CLIENT_ID?: string;
  HEALOW_CLIENT_ID?: string;
  ATHENA_CLIENT_ID?: string;
  ATHENA_SANDBOX_CLIENT_ID?: string;
}

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

type EnvVar = keyof VendorEnv & string;

function channel(
  config: VendorEnv,
  candidates: { production?: EnvVar[]; sandbox?: EnvVar[] },
): VendorChannel {
  const firstConfigured = (envVars: EnvVar[] = []) =>
    envVars.find((envVar) => {
      const value = config[envVar];
      return typeof value === 'string' && isConfigured(value);
    });

  const production = firstConfigured(candidates.production);
  const sandbox = firstConfigured(candidates.sandbox);
  if (production) {
    return { status: 'production', production, sandbox };
  }
  if (sandbox) {
    return { status: 'sandbox-only', sandbox };
  }
  return {
    status: 'disabled',
    enableWith: [candidates.production?.[0], candidates.sandbox?.[0]].filter(
      (envVar): envVar is EnvVar => !!envVar,
    ),
  };
}

function onPatientChannel(config: VendorEnv): VendorChannel {
  const base = channel(config, { production: ['ONPATIENT_CLIENT_ID'] });
  if (base.status === 'production' && config.ONPATIENT_SECRET_CONFIGURED) {
    return base;
  }
  const missing = [
    ...(base.status === 'production' ? [] : ['ONPATIENT_CLIENT_ID']),
    ...(config.ONPATIENT_SECRET_CONFIGURED
      ? []
      : ['ONPATIENT_CLIENT_SECRET (on the server)']),
  ];
  return { status: 'disabled', enableWith: [missing.join(' and ')] };
}

function athenaChannel(config: VendorEnv): VendorChannel {
  const base = channel(config, {
    production: ['ATHENA_CLIENT_ID'],
    sandbox: ['ATHENA_SANDBOX_CLIENT_ID'],
  });
  // athena login always uses production when configured, making a sandbox id unreachable alongside it
  return base.status === 'production' ? { ...base, sandbox: undefined } : base;
}

export function parseVendorConfig(config: VendorEnv): VendorConfigModel {
  return {
    epicR4: channel(config, {
      production: ['EPIC_CLIENT_ID_R4', 'EPIC_CLIENT_ID'],
      sandbox: ['EPIC_SANDBOX_CLIENT_ID_R4', 'EPIC_SANDBOX_CLIENT_ID'],
    }),
    epicDstu2: channel(config, {
      production: ['EPIC_CLIENT_ID_DSTU2', 'EPIC_CLIENT_ID'],
      sandbox: ['EPIC_SANDBOX_CLIENT_ID_DSTU2', 'EPIC_SANDBOX_CLIENT_ID'],
    }),
    cerner: channel(config, { production: ['CERNER_CLIENT_ID'] }),
    veradigm: channel(config, { production: ['VERADIGM_CLIENT_ID'] }),
    onpatient: onPatientChannel(config),
    // The VA integration only supports their sandbox environment
    va: channel(config, { sandbox: ['VA_CLIENT_ID'] }),
    healow: channel(config, { production: ['HEALOW_CLIENT_ID'] }),
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
