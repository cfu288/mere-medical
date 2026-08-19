import { findEpicTenantById } from '@mere/epic';

export const EPIC_SANDBOX_IDS = ['sandbox_epic', 'sandbox_epic_r4'] as const;

export function isEpicSandbox(epicId?: string): boolean {
  if (!epicId) return false;
  return EPIC_SANDBOX_IDS.includes(epicId as (typeof EPIC_SANDBOX_IDS)[number]);
}

/**
 * Resolves the FHIR base URL for an Epic connection.
 *
 * Epic's published endpoint list is authoritative, so the tenant id decides the
 * URL. Connections to tenants outside that list keep their stored location.
 *
 * @throws when the tenant is unpublished and the stored location is only an
 * origin, which carries no FHIR path to request against.
 */
/**
 * Fails when a connection cannot be tied to a tenant.
 *
 * Reconnecting keys on the tenant, so a connection without one would be saved
 * as a second, unlinked copy of itself.
 */
export function assertEpicTenantId(tenantId: string | undefined): string {
  if (!tenantId || tenantId === 'undefined') {
    throw new Error(
      'Connection predates tenant tracking - remove it and add it again',
    );
  }
  return tenantId;
}

export function resolveEpicFhirBaseUrl(connection: {
  tenant_id?: string;
  location: string | Location;
}): string {
  const published = findEpicTenantById(connection.tenant_id)?.url;
  if (published) {
    return published;
  }

  const location = String(connection.location);
  if (new URL(location).pathname === '/') {
    throw new Error(
      `Connection is missing a FHIR base URL - reconnect to ${location}`,
    );
  }

  return location;
}
