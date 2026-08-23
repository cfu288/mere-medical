import { Logger, Module, ModuleMetadata } from '@nestjs/common';
import { OnPatientModule } from './onpatient/onpatient.module';
import { AppController } from './app.controller';
import { StaticModule } from './static/static.module';
import { LoginProxyModule } from './proxy/proxy.module';
import { CernerModule } from './cerner/cerner.module';
import { EpicModule } from './epic/epic.module';
import { HealowModule } from './healow/healow.module';
import { VeradigmModule } from './veradigm/veradigm.module';
import { AthenaModule } from './athena/athena.module';
import { NextGenModule } from './nextgen/nextgen.module';
import { TenantModule } from './tenant/tenant.module';
import { ConfigModule } from './config/config.module';
import { describeRequirement, EnableRequirement } from '@mere/shared';
import { serverVendorConfig } from './vendor-config.server';

const vendors = serverVendorConfig();

function logChannel(
  name: string,
  channel:
    | { status: 'disabled'; enableWith: EnableRequirement }
    | { status: 'production' | 'sandbox-only' },
) {
  if (channel.status === 'disabled') {
    Logger.warn(
      `${name} service disabled: set ${describeRequirement(channel.enableWith)} to enable.`,
    );
  } else {
    Logger.log(`${name} service enabled (${channel.status}).`);
  }
}

if (vendors.publicUrl.status !== 'configured') {
  Logger.error(
    vendors.publicUrl.status === 'invalid'
      ? `PUBLIC_URL is set to "${vendors.publicUrl.value}" but is not a valid URL: logins, tenant search, and the API proxy will not work until it is a full URL (including https://) for this instance.`
      : 'PUBLIC_URL is not set: logins, tenant search, and the API proxy will not work until it is set to the URL this instance is served from.',
  );
}

logChannel('Epic R4', vendors.epicR4);
logChannel('Epic DSTU2', vendors.epicDstu2);
logChannel('Cerner', vendors.cerner);
logChannel('Veradigm', vendors.veradigm);
logChannel('OnPatient', vendors.onpatient);
logChannel('Healow', vendors.healow);
logChannel('Athena', vendors.athena);
logChannel('NextGen', vendors.nextgen);
if (vendors.healow.status === 'production') {
  Logger.log(
    vendors.healow.mode === 'confidential'
      ? 'HEALOW_CLIENT_SECRET was provided: Healow confidential client mode enabled with refresh token support.'
      : 'HEALOW_CLIENT_SECRET was not provided: Healow public client mode enabled (no refresh tokens).',
  );
}

const imports: ModuleMetadata['imports'] = [
  StaticModule,
  LoginProxyModule,
  TenantModule,
  ConfigModule,
];

if (vendors.onpatient.status === 'production') {
  imports.push(OnPatientModule.register(vendors.onpatient.registration));
}

if (
  vendors.epicR4.status !== 'disabled' ||
  vendors.epicDstu2.status !== 'disabled'
) {
  imports.push(EpicModule);
}

if (vendors.cerner.status !== 'disabled') {
  imports.push(CernerModule);
}

if (vendors.veradigm.status !== 'disabled') {
  imports.push(VeradigmModule);
}

if (vendors.healow.status !== 'disabled') {
  imports.push(HealowModule);
}

if (vendors.athena.status !== 'disabled') {
  imports.push(AthenaModule);
}

if (vendors.nextgen.status === 'production') {
  imports.push(NextGenModule.register(vendors.nextgen.registration));
}

@Module({
  imports,
  controllers: [AppController],
})
export class AppModule {}
