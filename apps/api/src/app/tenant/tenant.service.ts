import { Inject, Injectable } from '@nestjs/common';
import {
  FhirVersion,
  SearchableVendor,
  TenantSearchResult,
  WIRE_VENDOR,
  fromWireVendor,
  toSearchResult,
} from '@mere/shared';
import { TenantDb, searchTenants } from '@mere/tenant-db';
import { TENANT_DB } from '../tenant-db/tenant-db.module';

@Injectable()
export class TenantService {
  constructor(@Inject(TENANT_DB) private readonly db: TenantDb) {}

  async queryTenants(
    query: unknown,
    vendors: unknown,
  ): Promise<TenantSearchResult[]> {
    return this.search(query, vendors, 'DSTU2');
  }

  async queryR4Tenants(
    query: unknown,
    vendors: unknown,
  ): Promise<TenantSearchResult[]> {
    return this.search(query, vendors, 'R4');
  }

  async queryAllTenants(
    query: unknown,
    vendors: unknown,
  ): Promise<TenantSearchResult[]> {
    return this.search(query, vendors, undefined);
  }

  private search(
    query: unknown,
    vendors: unknown,
    fhirVersion: FhirVersion | undefined,
  ): TenantSearchResult[] {
    return searchTenants(this.db, query, {
      vendors: toSearchableVendors(vendors),
      fhirVersion,
    }).map(toSearchResult);
  }
}

/**
 * Reads the uppercase vendor names the browser sends.
 *
 * Returns undefined when no vendor was asked for, and an empty array when every name
 * given was unrecognised, so an unknown vendor narrows the search to nothing rather
 * than widening it to everything.
 */
function toSearchableVendors(vendors: unknown): SearchableVendor[] | undefined {
  const values = Array.isArray(vendors) ? vendors : [vendors];
  const requested = values.filter(
    (vendor): vendor is string =>
      typeof vendor === 'string' && vendor.length > 0,
  );
  if (values.every((vendor) => vendor === undefined || vendor === '')) {
    return undefined;
  }
  return requested
    .map((vendor) => WIRE_VENDOR.safeParse(vendor.toUpperCase()))
    .filter((parsed) => parsed.success)
    .map((parsed) => fromWireVendor[parsed.data]);
}
