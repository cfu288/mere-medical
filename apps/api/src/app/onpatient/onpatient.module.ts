import { DynamicModule, Logger, Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { OnPatientController } from './onpatient.controller';
import { OnPatientService, OnPatientServiceConfig } from './onpatient.service';

@Module({})
export class OnPatientModule {
  static register(options: OnPatientServiceConfig): DynamicModule {
    return {
      imports: [HttpModule],
      controllers: [OnPatientController],
      providers: [{ provide: 'CONFIG', useValue: options }, OnPatientService],
      module: OnPatientModule,
      exports: [OnPatientService],
    };
  }
}
