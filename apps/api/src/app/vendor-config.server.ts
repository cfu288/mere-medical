import {
  EnableRequirement,
  isConfigured,
  parseAppKey,
  parseVendorConfig,
  PublicUrlConfig,
  publicUrlRequirement,
  VendorConfigModel,
} from '@mere/shared';
import { OnPatientServiceConfig } from './onpatient/onpatient.service';
import { NextGenModuleConfig } from './nextgen/nextgen.config';
import { registrationToken } from './registration-token';

export type OnPatientServerChannel =
  | { status: 'disabled'; enableWith: EnableRequirement }
  | { status: 'production'; registration: OnPatientServiceConfig };

export type NextGenServerChannel =
  | { status: 'disabled'; enableWith: EnableRequirement }
  | { status: 'production'; registration: NextGenModuleConfig };

export type RegistrationAccess =
  | { mode: 'open' }
  | { mode: 'keyed'; token: string; contact?: string }
  | { mode: 'public' };

export interface ServerVendorConfig
  extends Omit<VendorConfigModel, 'onpatient' | 'nextgen'> {
  onpatient: OnPatientServerChannel;
  nextgen: NextGenServerChannel;
  registrationAccess: RegistrationAccess;
}

const APP_KEY_DOCS_URL =
  'https://meremedical.co/docs/getting-started/docker#app-key';

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
  const onpatient = onPatientServerChannel(env, model.publicUrl);
  const nextgen = nextGenServerChannel(env);
  const confidentialRoutes =
    (model.healow.status === 'production' &&
      model.healow.mode === 'confidential') ||
    onpatient.status === 'production' ||
    nextgen.status === 'production';
  return {
    ...model,
    onpatient,
    nextgen,
    registrationAccess: confidentialRoutes
      ? confidentialRegistrationAccess(env)
      : { mode: 'open' },
  };
}

export function allowsPublicConfidentialClients(
  env: Record<string, string | undefined>,
): boolean {
  return env.ALLOW_PUBLIC_CONFIDENTIAL_CLIENTS?.trim().toLowerCase() === 'true';
}

function confidentialRegistrationAccess(
  env: Record<string, string | undefined>,
): RegistrationAccess {
  const key = parseAppKey(env.APP_KEY);
  switch (key.status) {
    case 'ok':
      return {
        mode: 'keyed',
        token: registrationToken(key.key),
        contact: appContact(env),
      };
    case 'wrong-format':
      throw new Error(APP_KEY_WRONG_FORMAT);
    case 'missing':
      if (allowsPublicConfidentialClients(env)) {
        return { mode: 'public' };
      }
      throw new Error(APP_KEY_MISSING);
  }
}

function appContact(
  env: Record<string, string | undefined>,
): string | undefined {
  return env.APP_CONTACT?.trim() || undefined;
}

const APP_KEY_WRONG_FORMAT = [
  'APP_KEY must be the 32 characters that generate-app-key prints (letters, digits, - and _).',
  'Generate one with: docker compose run --rm app generate-app-key',
  `Docs: ${APP_KEY_DOCS_URL}`,
].join('\n');

const APP_KEY_MISSING = [
  'A Healow, NextGen, or OnPatient client secret is configured, so this instance requires APP_KEY.',
  'Generate a key with: docker compose run --rm app generate-app-key',
  '  or, in a source checkout: npm run generate-app-key',
  'Set APP_KEY to that value and recreate the container.',
  'Then print the invite link with: docker compose run --rm app generate-invite-link',
  '  or, in a source checkout: npm run generate-invite-link',
  'Share that link with the people who use this instance.',
  'To run a public instance instead, set ALLOW_PUBLIC_CONFIDENTIAL_CLIENTS=true.',
  `Docs: ${APP_KEY_DOCS_URL}`,
].join('\n');

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
