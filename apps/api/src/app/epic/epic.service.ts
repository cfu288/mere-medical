import { Inject, Injectable } from '@nestjs/common';
import { VendorEndpoint, toVendorEndpoint } from '@mere/shared';
import { TenantDb, searchTenants } from '@mere/tenant-db';
import { TENANT_DB } from '../tenant-db/tenant-db.module';

@Injectable()
export class EpicService {
  constructor(@Inject(TENANT_DB) private readonly db: TenantDb) {}

  async queryTenants(
    query: string,
    sandboxOnly = false,
  ): Promise<VendorEndpoint[]> {
    return this.search(query, 'DSTU2', sandboxOnly);
  }

  async queryR4Tenants(
    query: string,
    sandboxOnly = false,
  ): Promise<VendorEndpoint[]> {
    return this.search(query, 'R4', sandboxOnly);
  }

  private search(
    query: string,
    fhirVersion: 'DSTU2' | 'R4',
    sandboxOnly: boolean,
  ): VendorEndpoint[] {
    return searchTenants(this.db, query, {
      vendors: ['epic'],
      fhirVersion,
      source: sandboxOnly ? 'sandbox' : undefined,
    }).map(toVendorEndpoint);
  }
}
