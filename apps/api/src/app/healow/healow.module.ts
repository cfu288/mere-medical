import { Module } from '@nestjs/common';
import { HealowService } from './healow.service';
import { HealowController } from './healow.controller';

@Module({
  controllers: [HealowController],
  providers: [HealowService],
})
export class HealowModule {}
