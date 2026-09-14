import { Inject, Injectable } from '@nestjs/common';
import { VendorEndpoint, toVendorEndpoint } from '@mere/shared';
import { TenantDb, findTenantById, searchTenants } from '@mere/tenant-db';
import { TENANT_DB } from '../tenant-db/tenant-db.module';

@Injectable()
export class HealowService {
  constructor(@Inject(TENANT_DB) private readonly db: TenantDb) {}

  async queryR4Tenants(query: string): Promise<VendorEndpoint[]> {
    const tenants = await searchTenants(this.db, query, {
      vendors: ['healow'],
      fhirVersion: 'R4',
    });
    return tenants.map(toVendorEndpoint);
  }

  async findTenantById(tenantId: string): Promise<VendorEndpoint | undefined> {
    const tenant = await findTenantById(this.db, 'healow', tenantId, 'R4');
    return tenant ? toVendorEndpoint(tenant) : undefined;
  }
}
