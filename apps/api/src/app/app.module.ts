import { Logger, Module, ModuleMetadata } from '@nestjs/common';
import { OnPatientModule } from './onpatient/onpatient.module';
import { AppController } from './app.controller';
import { StaticModule } from './static/static.module';
import { LoginProxyModule } from './proxy/proxy.module';
import { CernerModule } from './cerner/cerner.module';
import { EpicModule } from './epic/epic.module';
import { VeradigmModule } from './veradigm/veradigm.module';
import { TenantModule } from './tenant/tenant.module';
import { LoggerModule } from 'nestjs-pino';

const imports: ModuleMetadata['imports'] = [
  StaticModule,
  LoginProxyModule,
  CernerModule,
  EpicModule,
  VeradigmModule,
  TenantModule,
];

if (checkIfSentryConfigured()) {
  imports.unshift(
    LoggerModule.forRoot({
      pinoHttp: {
        level: 'info',
        transport: {
          target: 'pino-sentry-transport',
          options: {
            sentry: {
              dsn: process.env.SENTRY_DSN,
              // additional options for sentry
            },
            withLogRecord: true, // default false - send the log record to sentry as a context.(if its more then 8Kb Sentry will throw an error)
            tags: ['id'], // sentry tags to add to the event, uses lodash.get to get the value from the log record
            context: ['hostname'], // sentry context to add to the event, uses lodash.get to get the value from the log record,
            minLevel: 20, // which level to send to sentry
          },
        },
      },
    })
  );
} else {
  imports.unshift(
    LoggerModule.forRoot({
      pinoHttp: {
        level: 'info',
        transport: { target: 'pino-pretty' },
      },
    })
  );
}

if (checkIfOnPatientConfigured()) {
  imports.push(
    OnPatientModule.register({
      clientId: process.env.ONPATIENT_CLIENT_ID,
      clientSecret: process.env.ONPATIENT_CLIENT_SECRET,
      redirectUri: `${process.env.PUBLIC_URL}/api/v1/onpatient/callback`,
    })
  );
}

@Module({
  imports,
  controllers: [AppController],
})
export class AppModule {}

// --- Helper functions ---

function checkIfOnPatientConfigured(): boolean {
  const check =
    !!process.env.ONPATIENT_CLIENT_ID && !!process.env.ONPATIENT_CLIENT_SECRET;
  if (!process.env.ONPATIENT_CLIENT_ID) {
    Logger.warn(
      'ONPATIENT_CLIENT_ID was not provided: OnPatient services will be disabled.'
    );
  }
  if (!process.env.ONPATIENT_CLIENT_SECRET) {
    Logger.warn(
      'ONPATIENT_CLIENT_SECRET was not provided: OnPatient services will be disabled.'
    );
  }
  if (check) {
    Logger.log(
      'ONPATIENT_CLIENT_ID and ONPATIENT_CLIENT_SECRET were provided: OnPatient service will be enabled.'
    );
  }

  return check;
}

function checkIfSentryConfigured(): boolean {
  if (!process.env.SENTRY_DSN) {
    Logger.warn(
      'SENTRY_DSN was not provided: Sentry logging will be disabled.'
    );
  } else {
    Logger.log('SENTRY_DSN was provided: Sentry logging will be enabled.');
  }
  return !!process.env.SENTRY_DSN;
}
