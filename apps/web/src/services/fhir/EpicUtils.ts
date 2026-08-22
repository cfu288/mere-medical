export const EPIC_SANDBOX_IDS = ['sandbox_epic', 'sandbox_epic_r4'] as const;

export function isEpicSandbox(epicId?: string): boolean {
  if (!epicId) return false;
  return EPIC_SANDBOX_IDS.includes(epicId as (typeof EPIC_SANDBOX_IDS)[number]);
}

/**
 * Fails when a connection cannot be tied to a tenant.
 *
 * Reconnecting keys on the tenant, so a connection without one would be saved
 * as a second, unlinked copy of itself.
 */
export function parseEpicTenantId(tenantId: string | undefined): string {
  if (!tenantId || tenantId === 'undefined') {
    throw new Error(
      'Connection predates tenant tracking - remove it and add it again',
    );
  }
  return tenantId;
}

/**
 * Returns the stored FHIR base URL for an Epic connection.
 *
 * @throws when the stored location carries no FHIR path to request against,
 * which a connection saved before the base URL was recorded in full will hit.
 */
export function parseEpicFhirBaseUrl(location: string | Location): string {
  const stored = String(location);

  let pathname: string;
  try {
    pathname = new URL(stored).pathname;
  } catch {
    throw new Error(`Connection has an unusable address: ${stored}`);
  }
  if (pathname === '/') {
    throw new Error(
      `Connection is missing a FHIR base URL - remove it and add it again`,
    );
  }
  return stored;
}
