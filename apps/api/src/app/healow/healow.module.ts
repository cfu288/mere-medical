import { Module } from '@nestjs/common';
import { HealowService } from './healow.service';
import { HealowController } from './healow.controller';
import { ConfigModule } from '../config/config.module';

@Module({
  imports: [ConfigModule],
  controllers: [HealowController],
  providers: [HealowService],
})
export class HealowModule {}
