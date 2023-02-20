import { DynamicModule, Logger, Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { CernerService } from './cerner.service';
import { CernerController } from './cerner.controller';

@Module({
  controllers: [CernerController],
  providers: [CernerService],
})
export class CernerModule {}
