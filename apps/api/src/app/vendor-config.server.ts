import {
  EnableRequirement,
  isConfigured,
  parseVendorConfig,
  PublicUrlConfig,
  publicUrlRequirement,
  VendorConfigModel,
} from '@mere/shared';
import { OnPatientServiceConfig } from './onpatient/onpatient.service';
import { NextGenModuleConfig } from './nextgen/nextgen.config';

export type OnPatientServerChannel =
  | { status: 'disabled'; enableWith: EnableRequirement }
  | { status: 'production'; registration: OnPatientServiceConfig };

export type NextGenServerChannel =
  | { status: 'disabled'; enableWith: EnableRequirement }
  | { status: 'production'; registration: NextGenModuleConfig };

export interface ServerVendorConfig
  extends Omit<VendorConfigModel, 'onpatient' | 'nextgen'> {
  onpatient: OnPatientServerChannel;
  nextgen: NextGenServerChannel;
}

let parsed: ServerVendorConfig | undefined;

export function serverVendorConfig(): ServerVendorConfig {
  return (parsed ??= parseServerVendorConfig(process.env));
}

export function parseServerVendorConfig(
  env: Record<string, string | undefined>,
): ServerVendorConfig {
  const model = parseVendorConfig({
    ...env,
    ONPATIENT_SECRET_CONFIGURED: !!env.ONPATIENT_CLIENT_SECRET,
    HEALOW_CONFIDENTIAL_MODE: !!env.HEALOW_CLIENT_SECRET,
    NEXTGEN_SECRET_CONFIGURED: isConfigured(env.NEXTGEN_CLIENT_SECRET),
  });
  return {
    ...model,
    onpatient: onPatientServerChannel(env, model.publicUrl),
    nextgen: nextGenServerChannel(env),
  };
}

function nextGenServerChannel(
  env: Record<string, string | undefined>,
): NextGenServerChannel {
  const clientId = env.NEXTGEN_CLIENT_ID;
  const clientSecret = env.NEXTGEN_CLIENT_SECRET;
  if (!isConfigured(clientId)) {
    return {
      status: 'disabled',
      enableWith: {
        allOf: [
          'NEXTGEN_CLIENT_ID',
          ...(isConfigured(clientSecret) ? [] : ['NEXTGEN_CLIENT_SECRET']),
        ],
      },
    };
  }
  if (!isConfigured(clientSecret)) {
    return {
      status: 'disabled',
      enableWith: { allOf: ['NEXTGEN_CLIENT_SECRET'] },
    };
  }
  return { status: 'production', registration: { clientId, clientSecret } };
}

function onPatientServerChannel(
  env: Record<string, string | undefined>,
  publicUrl: PublicUrlConfig,
): OnPatientServerChannel {
  const clientId = env.ONPATIENT_CLIENT_ID;
  const clientSecret = env.ONPATIENT_CLIENT_SECRET;
  const secretMissing = clientSecret
    ? []
    : (['ONPATIENT_CLIENT_SECRET'] as const);
  const publicUrlMissing =
    publicUrl.status === 'configured'
      ? []
      : ([publicUrlRequirement(publicUrl)] as const);
  if (!isConfigured(clientId)) {
    return {
      status: 'disabled',
      enableWith: {
        allOf: ['ONPATIENT_CLIENT_ID', ...secretMissing, ...publicUrlMissing],
      },
    };
  }
  if (!clientSecret) {
    return {
      status: 'disabled',
      enableWith: { allOf: ['ONPATIENT_CLIENT_SECRET', ...publicUrlMissing] },
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
    registration: { clientId, clientSecret, publicUrl: publicUrl.value },
  };
}
