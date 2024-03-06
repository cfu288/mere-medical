import { Logger, Module, ModuleMetadata } from '@nestjs/common';
import { OnPatientModule } from './onpatient/onpatient.module';
import { AppController } from './app.controller';
import { StaticModule } from './static/static.module';
import { LoginProxyModule } from './proxy/proxy.module';
import { CernerModule } from './cerner/cerner.module';
import { EpicModule } from './epic/epic.module';
import { VeradigmModule } from './veradigm/veradigm.module';
import { TenantModule } from './tenant/tenant.module';
import { VAModule } from './va/va.module';
import { LoggerModule } from 'nestjs-pino';

const imports: ModuleMetadata['imports'] = [
  StaticModule,
  LoginProxyModule,
  EpicModule,
  CernerModule,
  VeradigmModule,
  TenantModule,
  VAModule,
];

imports.unshift(
  LoggerModule.forRoot({
    pinoHttp: {
      level: 'info',
      transport: { target: 'pino-pretty' },
    },
  }),
);

const opConfigured = checkIfOnPatientConfigured();
if (opConfigured.check) {
  imports.push(
    OnPatientModule.register({
      clientId: opConfigured.clientId,
      clientSecret: opConfigured.clientSecret,
      redirectUri: `${process.env.PUBLIC_URL}/api/v1/onpatient/callback`,
    }),
  );
}

@Module({
  imports,
  controllers: [AppController],
})
export class AppModule {}

// --- Helper functions ---

function checkIfOnPatientConfigured():
  | {
      check: true;
      clientId: string;
      clientSecret: string;
    }
  | { check: false } {
  const check =
    !!process.env.ONPATIENT_CLIENT_ID && !!process.env.ONPATIENT_CLIENT_SECRET;
  if (!process.env.ONPATIENT_CLIENT_ID) {
    Logger.warn(
      'ONPATIENT_CLIENT_ID was not provided: OnPatient services will be disabled.',
    );
  }
  if (!process.env.ONPATIENT_CLIENT_SECRET) {
    Logger.warn(
      'ONPATIENT_CLIENT_SECRET was not provided: OnPatient services will be disabled.',
    );
  }
  if (check) {
    Logger.log(
      'ONPATIENT_CLIENT_ID and ONPATIENT_CLIENT_SECRET were provided: OnPatient service will be enabled.',
    );

    return {
      check,
      clientId: process.env.ONPATIENT_CLIENT_ID!,
      clientSecret: process.env.ONPATIENT_CLIENT_SECRET!,
    };
  }

  return { check };
}
