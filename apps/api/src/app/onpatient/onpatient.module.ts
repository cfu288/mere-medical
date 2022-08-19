import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { OnPatientController } from './onpatient.controller';
import { OnPatientService } from './onpatient.service';

@Module({
  imports: [HttpModule],
  controllers: [OnPatientController],
  providers: [OnPatientService],
})
export class OnPatientModule {}
