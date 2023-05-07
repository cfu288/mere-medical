import { Module } from '@nestjs/common';
import { TenantService } from './tenant.service';
import { TenantController } from './tenant.controller';

@Module({
  controllers: [TenantController],
  providers: [TenantService],
})
export class TenantModule {}
