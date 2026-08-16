export interface VendorEnv {
  PUBLIC_URL?: string;
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
  HEALOW_CONFIDENTIAL_MODE?: boolean;
  ATHENA_CLIENT_ID?: string;
  ATHENA_SANDBOX_CLIENT_ID?: string;
}

export function isConfigured(value: string | undefined): value is string {
  return !!value && !value.startsWith('$');
}

export interface Credential {
  envVar: string;
  value: string;
}

export type EnableRequirement =
  | { anyOf: [string, ...string[]] }
  | { allOf: [string, ...string[]] };

export function describeRequirement(requirement: EnableRequirement): string {
  return 'anyOf' in requirement
    ? requirement.anyOf.join(' or ')
    : requirement.allOf.join(' and ');
}

export type VendorChannel =
  | { status: 'disabled'; enableWith: EnableRequirement }
  | { status: 'sandbox-only'; sandbox: Credential }
  | { status: 'production'; production: Credential; sandbox?: Credential };

export type ProductionOnlyChannel =
  | { status: 'disabled'; enableWith: EnableRequirement }
  | { status: 'production'; production: Credential };

export type SandboxOnlyChannel =
  | { status: 'disabled'; enableWith: EnableRequirement }
  | { status: 'sandbox-only'; sandbox: Credential };

export type HealowChannel =
  | { status: 'disabled'; enableWith: EnableRequirement }
  | {
      status: 'production';
      production: Credential;
      mode: 'confidential' | 'public';
    };

export type OnPatientChannel =
  | { status: 'disabled'; enableWith: EnableRequirement }
  | { status: 'production'; production: Credential; publicUrl: string };

export type PublicUrlConfig =
  | { status: 'configured'; value: string; origin: string }
  | { status: 'missing' };

export interface VendorConfigModel {
  publicUrl: PublicUrlConfig;
  epicR4: VendorChannel;
  epicDstu2: VendorChannel;
  cerner: ProductionOnlyChannel;
  veradigm: ProductionOnlyChannel;
  onpatient: OnPatientChannel;
  va: SandboxOnlyChannel;
  healow: HealowChannel;
  athena: ProductionOnlyChannel | SandboxOnlyChannel;
}

type EnvVar = {
  [K in keyof VendorEnv]-?: VendorEnv[K] extends string | undefined ? K : never;
}[keyof VendorEnv];
type EnvVarCandidates = [EnvVar, ...EnvVar[]];

function channel(
  config: VendorEnv,
  candidates: { production: EnvVarCandidates; sandbox: EnvVarCandidates },
): VendorChannel;
function channel(
  config: VendorEnv,
  candidates: { production: EnvVarCandidates },
): ProductionOnlyChannel;
function channel(
  config: VendorEnv,
  candidates: { sandbox: EnvVarCandidates },
): SandboxOnlyChannel;
function channel(
  config: VendorEnv,
  candidates:
    | { production: EnvVarCandidates; sandbox: EnvVarCandidates }
    | { production: EnvVarCandidates; sandbox?: undefined }
    | { production?: undefined; sandbox: EnvVarCandidates },
): VendorChannel {
  const firstConfigured = (envVars: EnvVar[] = []): Credential | undefined => {
    for (const envVar of envVars) {
      const value = config[envVar];
      if (isConfigured(value)) {
        return { envVar, value };
      }
    }
    return undefined;
  };

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
    enableWith: {
      anyOf: candidates.production
        ? candidates.sandbox
          ? [candidates.production[0], candidates.sandbox[0]]
          : [candidates.production[0]]
        : [candidates.sandbox[0]],
    },
  };
}

function publicUrlConfig(config: VendorEnv): PublicUrlConfig {
  if (!isConfigured(config.PUBLIC_URL)) {
    return { status: 'missing' };
  }
  try {
    return {
      status: 'configured',
      value: config.PUBLIC_URL,
      origin: new URL(config.PUBLIC_URL).origin,
    };
  } catch {
    // a PUBLIC_URL that cannot parse as a URL is as unusable as an absent one
    return { status: 'missing' };
  }
}

function onPatientChannel(
  config: VendorEnv,
  publicUrl: PublicUrlConfig,
): OnPatientChannel {
  const base = channel(config, { production: ['ONPATIENT_CLIENT_ID'] });
  const secretMissing = config.ONPATIENT_SECRET_CONFIGURED
    ? []
    : (['ONPATIENT_CLIENT_SECRET (on the server)'] as const);
  const publicUrlMissing =
    publicUrl.status === 'configured' ? [] : (['PUBLIC_URL'] as const);
  if (base.status === 'disabled') {
    return {
      status: 'disabled',
      enableWith: {
        allOf: ['ONPATIENT_CLIENT_ID', ...secretMissing, ...publicUrlMissing],
      },
    };
  }
  if (!config.ONPATIENT_SECRET_CONFIGURED) {
    return {
      status: 'disabled',
      enableWith: {
        allOf: ['ONPATIENT_CLIENT_SECRET (on the server)', ...publicUrlMissing],
      },
    };
  }
  if (publicUrl.status === 'missing') {
    return { status: 'disabled', enableWith: { allOf: ['PUBLIC_URL'] } };
  }
  return {
    status: 'production',
    production: base.production,
    publicUrl: publicUrl.value,
  };
}

function healowChannel(config: VendorEnv): HealowChannel {
  const base = channel(config, { production: ['HEALOW_CLIENT_ID'] });
  return base.status === 'production'
    ? {
        ...base,
        mode: config.HEALOW_CONFIDENTIAL_MODE ? 'confidential' : 'public',
      }
    : base;
}

function athenaChannel(
  config: VendorEnv,
): ProductionOnlyChannel | SandboxOnlyChannel {
  const base = channel(config, {
    production: ['ATHENA_CLIENT_ID'],
    sandbox: ['ATHENA_SANDBOX_CLIENT_ID'],
  });
  // athena login always uses production when configured, making a sandbox id unreachable alongside it
  return base.status === 'production'
    ? { status: 'production', production: base.production }
    : base;
}

export function parseVendorConfig(config: VendorEnv): VendorConfigModel {
  const publicUrl = publicUrlConfig(config);
  return {
    publicUrl,
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
    onpatient: onPatientChannel(config, publicUrl),
    // The VA integration only supports their sandbox environment
    va: channel(config, { sandbox: ['VA_CLIENT_ID'] }),
    healow: healowChannel(config),
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
      note:
        model.healow.status === 'production' &&
        model.healow.mode === 'confidential'
          ? 'Confidential mode (HEALOW_CLIENT_SECRET is set on the server)'
          : undefined,
    },
    { label: 'Athena Health', channel: model.athena },
  ];
}
