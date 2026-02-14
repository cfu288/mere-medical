import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { AthenaService } from './athena.service';
import { AthenaController } from './athena.controller';
import { OriginGuard } from '../proxy/guards/origin.guard';

@Module({
  imports: [
    ThrottlerModule.forRoot([
      { name: 'short', ttl: 1000, limit: 30 },
      { name: 'medium', ttl: 60000, limit: 600 },
    ]),
  ],
  controllers: [AthenaController],
  providers: [AthenaService, OriginGuard],
})
export class AthenaModule {}
