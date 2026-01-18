import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import * as bodyParser from 'body-parser';
import { HealowService } from './healow.service';
import { HealowController } from './healow.controller';
import { ConfigModule } from '../config/config.module';

@Module({
  imports: [ConfigModule],
  controllers: [HealowController],
  providers: [HealowService],
})
export class HealowModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(bodyParser.json())
      .forRoutes('v1/healow/token', 'v1/healow/refresh');
  }
}
