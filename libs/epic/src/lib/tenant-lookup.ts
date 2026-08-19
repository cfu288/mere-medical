import {
  DSTU2Endpoint,
  EpicDSTU2TenantEndpoints,
  EpicR4TenantEndpoints,
  R4Endpoint,
} from './epic';

export type EpicTenantEndpoint = (DSTU2Endpoint | R4Endpoint) & {
  fhirVersion: 'DSTU2' | 'R4';
};

const tenantsById = new Map<string, EpicTenantEndpoint>([
  ...EpicDSTU2TenantEndpoints.map(
    (endpoint) =>
      [endpoint.id, { ...endpoint, fhirVersion: 'DSTU2' as const }] as const,
  ),
  ...EpicR4TenantEndpoints.map(
    (endpoint) =>
      [endpoint.id, { ...endpoint, fhirVersion: 'R4' as const }] as const,
  ),
]);

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
