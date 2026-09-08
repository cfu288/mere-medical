import { Inject, Injectable } from '@nestjs/common';
import { TenantDb, findTenantById } from '@mere/tenant-db';
import { TENANT_DB } from '../tenant-db/tenant-db.module';

@Injectable()
export class AthenaService {
  constructor(@Inject(TENANT_DB) private readonly db: TenantDb) {}

  getOrganizationName(practiceId: string): string | undefined {
    return findTenantById(this.db, 'athena', practiceId, 'R4')?.name;
  }
}
