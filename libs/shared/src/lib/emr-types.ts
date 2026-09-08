import { z } from 'zod';

export const VENDOR = z.enum([
  'epic',
  'cerner',
  'veradigm',
  'healow',
  'athena',
]);
export type Vendor = z.infer<typeof VENDOR>;

/** Vendors whose tenants a user picks between in search. Athena resolves by practice id. */
export const SEARCHABLE_VENDOR = VENDOR.exclude(['athena']);
export type SearchableVendor = z.infer<typeof SEARCHABLE_VENDOR>;

export const FHIR_VERSION = z.enum(['DSTU2', 'R4']);
export type FhirVersion = z.infer<typeof FHIR_VERSION>;

export const DOC_TYPE = z.enum(['directory', 'capability']);
export type DocType = z.infer<typeof DOC_TYPE>;

export const ENDPOINT_SOURCE = z.enum(['directory', 'sandbox']);
export type EndpointSource = z.infer<typeof ENDPOINT_SOURCE>;

export const CAPABILITY_CLASSIFICATION = z.enum([
  'usable',
  'operation_outcome',
  'no_security_block',
  'missing_token',
  'missing_authorize',
  'unparseable',
]);
export type CapabilityClassification = z.infer<
  typeof CAPABILITY_CLASSIFICATION
>;

export const WIRE_VENDOR = z.enum(['EPIC', 'CERNER', 'VERADIGM', 'HEALOW']);
type WireVendor = z.infer<typeof WIRE_VENDOR>;

const toWireVendor: Record<SearchableVendor, WireVendor> = {
  epic: 'EPIC',
  cerner: 'CERNER',
  veradigm: 'VERADIGM',
  healow: 'HEALOW',
};

export const fromWireVendor: Record<WireVendor, SearchableVendor> = {
  EPIC: 'epic',
  CERNER: 'cerner',
  VERADIGM: 'veradigm',
  HEALOW: 'healow',
};

function isSearchableVendor(vendor: Vendor): vendor is SearchableVendor {
  return SEARCHABLE_VENDOR.safeParse(vendor).success;
}

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

export const tenantSearchResultSchema = z.object({
  id: z.string(),
  url: z.string(),
  name: z.string(),
  token: z.string(),
  authorize: z.string(),
  managingOrganization: z.string().optional(),
  vendor: WIRE_VENDOR,
  version: FHIR_VERSION,
});
export type TenantSearchResult = z.infer<typeof tenantSearchResultSchema>;

/** What a single-vendor tenant route returns: a search result without the vendor tag. */
export type VendorEndpoint = Omit<TenantSearchResult, 'vendor' | 'version'>;

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

/**
 * Projects a `tenants.db` row onto the HTTP contract `apps/web` consumes.
 *
 * Throws for a tenant no wire vendor covers, which is every Athena row.
 */
export function toSearchResult(tenant: Tenant): TenantSearchResult {
  if (!isSearchableVendor(tenant.vendor)) {
    throw new Error(`Vendor '${tenant.vendor}' has no wire representation`);
  }
  return {
    id: tenant.tenantId,
    url: tenant.url,
    name: tenant.name,
    token: tenant.token ?? '',
    authorize: tenant.authorize ?? '',
    managingOrganization: tenant.managingOrganization,
    vendor: toWireVendor[tenant.vendor],
    version: tenant.fhirVersion,
  };
}
