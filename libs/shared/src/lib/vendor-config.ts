import { z } from 'zod';

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
  NEXTGEN_CLIENT_ID?: string;
  NEXTGEN_SECRET_CONFIGURED?: boolean;
}

export function isConfigured(value: string | undefined): value is string {
  return !!value && !value.startsWith('$');
}

export type PublicUrlConfig =
  | { status: 'configured'; value: string; origin: string }
  | { status: 'invalid'; value: string }
  | { status: 'missing' };

const configuredString = z
  .string()
  .optional()
  .catch(undefined)
  .transform((value) => (isConfigured(value) ? value : undefined));

const configuredFlag = z.boolean().optional().catch(undefined);

const publicUrlField = z
  .string()
  .optional()
  .catch(undefined)
  .transform((value): PublicUrlConfig => {
    if (!isConfigured(value)) {
      return { status: 'missing' };
    }
    try {
      return { status: 'configured', value, origin: new URL(value).origin };
    } catch {
      return { status: 'invalid', value };
    }
  });

const vendorEnvSchema = z.object({
  PUBLIC_URL: publicUrlField,
  EPIC_CLIENT_ID: configuredString,
  EPIC_CLIENT_ID_DSTU2: configuredString,
  EPIC_CLIENT_ID_R4: configuredString,
  EPIC_SANDBOX_CLIENT_ID: configuredString,
  EPIC_SANDBOX_CLIENT_ID_DSTU2: configuredString,
  EPIC_SANDBOX_CLIENT_ID_R4: configuredString,
  CERNER_CLIENT_ID: configuredString,
  VERADIGM_CLIENT_ID: configuredString,
  ONPATIENT_CLIENT_ID: configuredString,
  ONPATIENT_SECRET_CONFIGURED: configuredFlag,
  VA_CLIENT_ID: configuredString,
  HEALOW_CLIENT_ID: configuredString,
  HEALOW_CONFIDENTIAL_MODE: configuredFlag,
  ATHENA_CLIENT_ID: configuredString,
  ATHENA_SANDBOX_CLIENT_ID: configuredString,
  NEXTGEN_CLIENT_ID: configuredString,
  NEXTGEN_SECRET_CONFIGURED: configuredFlag,
});

type ParsedVendorEnv = z.infer<typeof vendorEnvSchema>;

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

export type NextGenChannel =
  | { status: 'disabled'; enableWith: EnableRequirement }
  | { status: 'production'; production: Credential; publicUrl: string };

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
  nextgen: NextGenChannel;
}

type EnvVar = {
  [K in keyof ParsedVendorEnv]-?: ParsedVendorEnv[K] extends string | undefined
    ? K
    : never;
}[keyof ParsedVendorEnv];
type EnvVarCandidates = [EnvVar, ...EnvVar[]];

function channel(
  env: ParsedVendorEnv,
  candidates: { production: EnvVarCandidates; sandbox: EnvVarCandidates },
): VendorChannel;
function channel(
  env: ParsedVendorEnv,
  candidates: { production: EnvVarCandidates },
): ProductionOnlyChannel;
function channel(
  env: ParsedVendorEnv,
  candidates: { sandbox: EnvVarCandidates },
): SandboxOnlyChannel;
function channel(
  env: ParsedVendorEnv,
  candidates:
    | { production: EnvVarCandidates; sandbox: EnvVarCandidates }
    | { production: EnvVarCandidates; sandbox?: undefined }
    | { production?: undefined; sandbox: EnvVarCandidates },
): VendorChannel {
  const firstConfigured = (envVars: EnvVar[] = []): Credential | undefined => {
    for (const envVar of envVars) {
      const value = env[envVar];
      if (value !== undefined) {
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

export function publicUrlRequirement(
  publicUrl: { status: 'invalid' } | { status: 'missing' },
): string {
  return publicUrl.status === 'invalid' ? 'a valid PUBLIC_URL' : 'PUBLIC_URL';
}

function onPatientChannel(
  env: ParsedVendorEnv,
  publicUrl: PublicUrlConfig,
): OnPatientChannel {
  const base = channel(env, { production: ['ONPATIENT_CLIENT_ID'] });
  const secretMissing = env.ONPATIENT_SECRET_CONFIGURED
    ? []
    : (['ONPATIENT_CLIENT_SECRET (on the server)'] as const);
  const publicUrlMissing =
    publicUrl.status === 'configured'
      ? []
      : ([publicUrlRequirement(publicUrl)] as const);
  if (base.status === 'disabled') {
    return {
      status: 'disabled',
      enableWith: {
        allOf: ['ONPATIENT_CLIENT_ID', ...secretMissing, ...publicUrlMissing],
      },
    };
  }
  if (!env.ONPATIENT_SECRET_CONFIGURED) {
    return {
      status: 'disabled',
      enableWith: {
        allOf: ['ONPATIENT_CLIENT_SECRET (on the server)', ...publicUrlMissing],
      },
    };
  }
  if (publicUrl.status !== 'configured') {
    return {
      status: 'disabled',
      enableWith: { allOf: [publicUrlRequirement(publicUrl)] },
    };
  }
  return {
    status: 'production',
    production: base.production,
    publicUrl: publicUrl.value,
  };
}

function healowChannel(env: ParsedVendorEnv): HealowChannel {
  const base = channel(env, { production: ['HEALOW_CLIENT_ID'] });
  return base.status === 'production'
    ? {
        ...base,
        mode: env.HEALOW_CONFIDENTIAL_MODE ? 'confidential' : 'public',
      }
    : base;
}

function athenaChannel(
  env: ParsedVendorEnv,
): ProductionOnlyChannel | SandboxOnlyChannel {
  const base = channel(env, {
    production: ['ATHENA_CLIENT_ID'],
    sandbox: ['ATHENA_SANDBOX_CLIENT_ID'],
  });
  // athena login always uses production when configured, making a sandbox id unreachable alongside it
  return base.status === 'production'
    ? { status: 'production', production: base.production }
    : base;
}

function nextGenChannel(
  env: ParsedVendorEnv,
  publicUrl: PublicUrlConfig,
): NextGenChannel {
  const base = channel(env, { production: ['NEXTGEN_CLIENT_ID'] });
  const secretMissing = env.NEXTGEN_SECRET_CONFIGURED
    ? []
    : (['NEXTGEN_CLIENT_SECRET (on the server)'] as const);
  const publicUrlMissing =
    publicUrl.status === 'configured'
      ? []
      : ([publicUrlRequirement(publicUrl)] as const);
  if (base.status === 'disabled') {
    return {
      status: 'disabled',
      enableWith: {
        allOf: ['NEXTGEN_CLIENT_ID', ...secretMissing, ...publicUrlMissing],
      },
    };
  }
  if (!env.NEXTGEN_SECRET_CONFIGURED) {
    return {
      status: 'disabled',
      enableWith: {
        allOf: ['NEXTGEN_CLIENT_SECRET (on the server)', ...publicUrlMissing],
      },
    };
  }
  if (publicUrl.status !== 'configured') {
    return {
      status: 'disabled',
      enableWith: { allOf: [publicUrlRequirement(publicUrl)] },
    };
  }
  return {
    status: 'production',
    production: base.production,
    publicUrl: publicUrl.value,
  };
}

export function parseVendorConfig(config: VendorEnv): VendorConfigModel {
  const env = vendorEnvSchema.parse(config);
  const publicUrl = env.PUBLIC_URL;
  return {
    publicUrl,
    epicR4: channel(env, {
      production: ['EPIC_CLIENT_ID_R4', 'EPIC_CLIENT_ID'],
      sandbox: ['EPIC_SANDBOX_CLIENT_ID_R4', 'EPIC_SANDBOX_CLIENT_ID'],
    }),
    epicDstu2: channel(env, {
      production: ['EPIC_CLIENT_ID_DSTU2', 'EPIC_CLIENT_ID'],
      sandbox: ['EPIC_SANDBOX_CLIENT_ID_DSTU2', 'EPIC_SANDBOX_CLIENT_ID'],
    }),
    cerner: channel(env, { production: ['CERNER_CLIENT_ID'] }),
    veradigm: channel(env, { production: ['VERADIGM_CLIENT_ID'] }),
    onpatient: onPatientChannel(env, publicUrl),
    // The VA integration only supports their sandbox environment
    va: channel(env, { sandbox: ['VA_CLIENT_ID'] }),
    healow: healowChannel(env),
    athena: athenaChannel(env),
    nextgen: nextGenChannel(env, publicUrl),
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
    { label: 'NextGen Enterprise', channel: model.nextgen },
  ];
}
