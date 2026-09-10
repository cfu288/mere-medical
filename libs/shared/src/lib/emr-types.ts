export type Vendor = 'epic' | 'cerner' | 'veradigm' | 'healow' | 'athena';

/**
 * Vendors whose tenants a user picks between in search. Athena resolves by
 * practice id.
 */
export type SearchableVendor = Exclude<Vendor, 'athena'>;

export type FhirVersion = 'DSTU2' | 'R4';

export type EndpointSource = 'directory' | 'sandbox';

/**
 * Verdict on one capability download. `usable` means its SMART auth urls are complete,
 * and every other value names what was missing or wrong.
 */
export type CapabilityClassification =
  | 'usable'
  | 'operation_outcome'
  | 'no_security_block'
  | 'missing_token'
  | 'missing_authorize'
  | 'unparseable';

/** A row of `tenants.db`. Produced by the pipeline, read by `apps/api`. */
export interface Tenant {
  tenantId: string;
  vendor: Vendor;
  fhirVersion: FhirVersion;
  name: string;
  url: string;
  token?: string;
  authorize?: string;
  register?: string;
  managingOrganization?: string;
  source: EndpointSource;
  searchable: boolean;
}

/** What a single-vendor tenant route returns to the web app. */
export interface VendorEndpoint {
  id: string;
  url: string;
  name: string;
  token: string;
  authorize: string;
  managingOrganization?: string;
}

/**
 * Reshapes a tenant into the endpoint a route returns. A missing token or
 * authorize url becomes an empty string.
 */
export function toVendorEndpoint(tenant: Tenant): VendorEndpoint {
  return {
    id: tenant.tenantId,
    url: tenant.url,
    name: tenant.name,
    token: tenant.token ?? '',
    authorize: tenant.authorize ?? '',
    managingOrganization: tenant.managingOrganization,
  };
}
