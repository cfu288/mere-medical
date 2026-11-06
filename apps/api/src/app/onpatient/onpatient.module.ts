import { DynamicModule, Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { OnPatientController } from './onpatient.controller';
import {
  RegistrationTokenGuard,
  registrationAccessProvider,
} from '../proxy/guards';
import { OnPatientService, OnPatientServiceConfig } from './onpatient.service';

@Module({})
export class OnPatientModule {
  static register(options: OnPatientServiceConfig): DynamicModule {
    return {
      imports: [HttpModule],
      controllers: [OnPatientController],
      providers: [
        { provide: 'CONFIG', useValue: options },
        OnPatientService,
        RegistrationTokenGuard,
        registrationAccessProvider,
      ],
      module: OnPatientModule,
      exports: [OnPatientService],
    };
  }
}
