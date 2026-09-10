import { Module } from '@nestjs/common';
import { TenantDbModule } from '../tenant-db/tenant-db.module';
import { CernerService } from './cerner.service';
import { CernerController } from './cerner.controller';

@Module({
  imports: [TenantDbModule],
  controllers: [CernerController],
  providers: [CernerService],
})
export class CernerModule {}
