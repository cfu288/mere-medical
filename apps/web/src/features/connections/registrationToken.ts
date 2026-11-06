import { OAuthError } from '@mere/fhir-oauth';
import { getLocalConfig } from '../../app/providers/LocalConfigProvider';
import { AppConfig } from '../../app/providers/AppConfigProvider';
import { ConnectionSources } from '../../models/connection-document/ConnectionDocument.type';

export function mereAdministrator(config: AppConfig): string {
  return config.APP_CONTACT
    ? `your Mere administrator (${config.APP_CONTACT})`
    : 'your Mere administrator';
}

export function registrationTokenNeededMessage(config: AppConfig): string {
  return `To connect, open the invite link from ${mereAdministrator(config)}.`;
}

export function parseRegistrationToken(value: string): string | undefined {
  const token = value.trim();
  return /^[A-Za-z0-9_-]{43}$/.test(token) ? token : undefined;
}

function savedRegistrationToken(): string | undefined {
  return getLocalConfig().registration_token || undefined;
}

export function registrationTokenHeaders(): Record<string, string> {
  const token = savedRegistrationToken();
  return token ? { 'X-Registration-Token': token } : {};
}

export function isRegistrationTokenRejected(
  error: unknown,
): error is OAuthError {
  return (
    error instanceof OAuthError && error.code === 'registration_token_rejected'
  );
}

/**
 * True when connecting `source` needs a registration token this browser lacks.
 *
 * @param config - the loaded instance config
 * @param source - the vendor to connect
 * @returns true for OnPatient, NextGen, or confidential Healow without a saved token
 * @example needsRegistrationToken(config, 'nextgen')
 */
export function needsRegistrationToken(
  config: AppConfig,
  source: ConnectionSources,
): boolean {
  if (!config.REGISTRATION_TOKEN_REQUIRED) {
    return false;
  }
  const keyed =
    source === 'onpatient' ||
    source === 'nextgen' ||
    (source === 'healow' && !!config.HEALOW_CONFIDENTIAL_MODE);
  return keyed && savedRegistrationToken() === undefined;
}
