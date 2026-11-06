import {
  DynamicModule,
  MiddlewareConsumer,
  Module,
  NestModule,
} from '@nestjs/common';
import * as bodyParser from 'body-parser';
import { NextGenController } from './nextgen.controller';
import { NextGenModuleConfig } from './nextgen.config';
import {
  RegistrationTokenGuard,
  registrationAccessProvider,
} from '../proxy/guards';

@Module({})
export class NextGenModule implements NestModule {
  static register(options: NextGenModuleConfig): DynamicModule {
    return {
      controllers: [NextGenController],
      providers: [
        { provide: 'CONFIG', useValue: options },
        RegistrationTokenGuard,
        registrationAccessProvider,
      ],
      module: NextGenModule,
    };
  }

  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(bodyParser.json())
      .forRoutes('v1/nextgen/token', 'v1/nextgen/refresh');
  }
}
