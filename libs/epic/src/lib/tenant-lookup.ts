import {
  DSTU2Endpoint,
  EpicDSTU2TenantEndpoints,
  EpicR4TenantEndpoints,
  R4Endpoint,
} from './epic';

export type EpicTenantEndpoint = DSTU2Endpoint | R4Endpoint;

const tenantsById = new Map<string, EpicTenantEndpoint>(
  [...EpicDSTU2TenantEndpoints, ...EpicR4TenantEndpoints].map((endpoint) => [
    endpoint.id,
    endpoint,
  ]),
);

/**
 * Looks up an Epic tenant's published endpoints by its tenant id.
 *
 * The returned URLs are authoritative and must be used verbatim - Epic tenants
 * vary in path prefix and in the casing of the FHIR path segment.
 */
export function findEpicTenantById(
  tenantId: string | undefined,
): EpicTenantEndpoint | undefined {
  if (!tenantId) return undefined;
  return tenantsById.get(tenantId);
}

/**
 * Returns an Epic tenant's dynamic client registration endpoint, which sits
 * alongside its authorization endpoint rather than under its FHIR base.
 */
export function getEpicRegistrationUrl(
  tenantId: string | undefined,
): string | undefined {
  const tenant = findEpicTenantById(tenantId);
  if (!tenant) return undefined;

  const url = new URL('register', tenant.authorize);
  url.search = '';
  return url.toString();
}
