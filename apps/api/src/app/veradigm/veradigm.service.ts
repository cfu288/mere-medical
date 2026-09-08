import { Inject, Injectable } from '@nestjs/common';
import { VendorEndpoint, toVendorEndpoint } from '@mere/shared';
import { TenantDb, searchTenants } from '@mere/tenant-db';
import { TENANT_DB } from '../tenant-db/tenant-db.module';

@Injectable()
export class VeradigmService {
  constructor(@Inject(TENANT_DB) private readonly db: TenantDb) {}

  async queryTenants(query: string): Promise<VendorEndpoint[]> {
    return searchTenants(this.db, query, {
      vendors: ['veradigm'],
      fhirVersion: 'DSTU2',
    }).map(toVendorEndpoint);
  }
}
