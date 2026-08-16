import {
  EnableRequirement,
  isConfigured,
  parseVendorConfig,
  PublicUrlConfig,
  VendorConfigModel,
} from '@mere/shared';
import { OnPatientServiceConfig } from './onpatient/onpatient.service';

export type OnPatientServerChannel =
  | { status: 'disabled'; enableWith: EnableRequirement }
  | { status: 'production'; registration: OnPatientServiceConfig };

export interface ServerVendorConfig
  extends Omit<VendorConfigModel, 'onpatient'> {
  onpatient: OnPatientServerChannel;
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
  });
  return {
    ...model,
    onpatient: onPatientServerChannel(env, model.publicUrl),
  };
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
    publicUrl.status === 'configured' ? [] : (['PUBLIC_URL'] as const);
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
  if (publicUrl.status === 'missing') {
    return { status: 'disabled', enableWith: { allOf: ['PUBLIC_URL'] } };
  }
  return {
    status: 'production',
    registration: { clientId, clientSecret, publicUrl: publicUrl.value },
  };
}
