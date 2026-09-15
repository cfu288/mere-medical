import { Inject, Injectable } from '@nestjs/common';
import { VendorEndpoint, toVendorEndpoint } from '@mere/shared';
import { TenantDb, searchTenants } from '@mere/tenant-db';
import { TENANT_DB } from '../tenant-db/tenant-db.module';

export type UnifiedTenantEndpoint = VendorEndpoint & {
  vendor: string;
  version: 'DSTU2' | 'R4';
};

@Injectable()
export class TenantService {
  constructor(@Inject(TENANT_DB) private readonly db: TenantDb) {}

  async queryTenants(query: string): Promise<UnifiedTenantEndpoint[]> {
    return this.search(query, 'DSTU2');
  }

  async queryR4Tenants(query: string): Promise<UnifiedTenantEndpoint[]> {
    return this.search(query, 'R4');
  }

  private async search(
    query: string,
    fhirVersion: 'DSTU2' | 'R4',
  ): Promise<UnifiedTenantEndpoint[]> {
    const tenants = await searchTenants(this.db, query, { fhirVersion });
    return tenants.map((tenant) => ({
      ...toVendorEndpoint(tenant),
      vendor: tenant.vendor.toUpperCase(),
      version: fhirVersion,
    }));
  }
}
