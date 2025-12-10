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

const imports: ModuleMetadata['imports'] = [
  StaticModule,
  LoginProxyModule,
  TenantModule,
  VAModule,
];

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

const epicConfigured = checkIfEpicConfigured();
if (epicConfigured.check) {
  imports.push(EpicModule);
}

const cernerConfigured = checkIfCernerIsConfigured();
if (cernerConfigured.check) {
  imports.push(CernerModule);
}

const veradigmConfigured = checkIfVeradigmIsConfigured();
if (veradigmConfigured.check) {
  imports.push(VeradigmModule);
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

function checkIfEpicConfigured(): { check: boolean } {
  const hasDstu2 =
    !!process.env.EPIC_CLIENT_ID_DSTU2 || !!process.env.EPIC_CLIENT_ID;
  const hasR4 = !!process.env.EPIC_CLIENT_ID_R4 || !!process.env.EPIC_CLIENT_ID;
  const check = hasDstu2 || hasR4;

  if (!check) {
    Logger.warn(
      'No Epic client IDs provided (EPIC_CLIENT_ID, EPIC_CLIENT_ID_DSTU2, or EPIC_CLIENT_ID_R4): Epic services will be disabled.',
    );
  } else {
    if (hasDstu2) {
      Logger.log(
        'Epic DSTU2 client ID configured: Epic DSTU2 service enabled.',
      );
    } else {
      Logger.warn(
        'No Epic DSTU2 client ID (EPIC_CLIENT_ID_DSTU2 or EPIC_CLIENT_ID): Epic DSTU2 service disabled.',
      );
    }
    if (hasR4) {
      Logger.log('Epic R4 client ID configured: Epic R4 service enabled.');
    } else {
      Logger.warn(
        'No Epic R4 client ID (EPIC_CLIENT_ID_R4 or EPIC_CLIENT_ID): Epic R4 service disabled.',
      );
    }
  }

  return { check };
}

function checkIfCernerIsConfigured():
  | {
      check: true;
      clientId: string;
    }
  | {
      check: false;
    } {
  const check = !!process.env.CERNER_CLIENT_ID;
  if (!process.env.CERNER_CLIENT_ID) {
    Logger.warn(
      'CERNER_CLIENT_ID was not provided: Cerner services will be disabled.',
    );
  }
  if (check) {
    Logger.log(
      'CERNER_CLIENT_ID was provided: Cerner service will be enabled.',
    );

    return {
      check,
      clientId: process.env.CERNER_CLIENT_ID!,
    };
  }

  return { check };
}

function checkIfVeradigmIsConfigured():
  | {
      check: true;
      clientId: string;
    }
  | {
      check: false;
    } {
  const check = !!process.env.VERADIGM_CLIENT_ID;
  if (!process.env.VERADIGM_CLIENT_ID) {
    Logger.warn(
      'VERADIGM_CLIENT_ID was not provided: Veradigm services will be disabled.',
    );
  }
  if (check) {
    Logger.log(
      'VERADIGM_CLIENT_ID was provided: Veradigm service will be enabled.',
    );

    return {
      check,
      clientId: process.env.VERADIGM_CLIENT_ID!,
    };
  }

  return { check };
}
