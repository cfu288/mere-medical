import { Module } from '@nestjs/common';
import { VAController } from './va.controller';

@Module({
  controllers: [VAController],
})
export class VAModule {}
