import { Module } from '@nestjs/common';
import { VeradigmService } from './veradigm.service';
import { VeradigmController } from './veradigm.controller';

@Module({
  controllers: [VeradigmController],
  providers: [VeradigmService],
})
export class VeradigmModule {}
