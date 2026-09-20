import { Module } from '@nestjs/common';
import { TenantDbModule } from '../tenant-db/tenant-db.module';
import { EpicService } from './epic.service';
import { EpicController } from './epic.controller';

@Module({
  imports: [TenantDbModule],
  controllers: [EpicController],
  providers: [EpicService],
})
export class EpicModule {}
