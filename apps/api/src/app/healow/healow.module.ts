import { DynamicModule, Logger, Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { HealowService } from './healow.service';
import { HealowController } from './healow.controller';

@Module({
  controllers: [HealowController],
  providers: [HealowService],
})
export class HealowModule {}
