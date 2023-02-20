import { Module } from '@nestjs/common';
import { EpicService } from './epic.service';
import { EpicController } from './epic.controller';

@Module({
  controllers: [EpicController],
  providers: [EpicService],
})
export class EpicModule {}
