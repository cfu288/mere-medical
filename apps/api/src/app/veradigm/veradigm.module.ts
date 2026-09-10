import { Module } from '@nestjs/common';
import { TenantDbModule } from '../tenant-db/tenant-db.module';
import { VeradigmService } from './veradigm.service';
import { VeradigmController } from './veradigm.controller';

@Module({
  imports: [TenantDbModule],
  controllers: [VeradigmController],
  providers: [VeradigmService],
})
export class VeradigmModule {}
