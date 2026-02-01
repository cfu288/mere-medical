import { Module } from '@nestjs/common';
import { AthenaService } from './athena.service';
import { AthenaController } from './athena.controller';

@Module({
  controllers: [AthenaController],
  providers: [AthenaService],
})
export class AthenaModule {}
