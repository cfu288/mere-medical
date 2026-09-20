import { Module } from '@nestjs/common';
import { TenantDbModule } from '../tenant-db/tenant-db.module';
import { TenantService } from './tenant.service';
import { TenantController } from './tenant.controller';

@Module({
  imports: [TenantDbModule],
  controllers: [TenantController],
  providers: [TenantService],
})
export class TenantModule {}
