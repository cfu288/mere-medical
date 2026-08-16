import { Logger, Module, ModuleMetadata } from '@nestjs/common';
import { parseVendorConfig, VendorChannel } from '@mere/shared';
import { OnPatientModule } from './onpatient/onpatient.module';
import { AppController } from './app.controller';
import { StaticModule } from './static/static.module';
import { LoginProxyModule } from './proxy/proxy.module';
import { CernerModule } from './cerner/cerner.module';
import { EpicModule } from './epic/epic.module';
import { HealowModule } from './healow/healow.module';
import { VeradigmModule } from './veradigm/veradigm.module';
import { AthenaModule } from './athena/athena.module';
import { TenantModule } from './tenant/tenant.module';
import { ConfigModule } from './config/config.module';

const vendors = parseVendorConfig({
  ...process.env,
  ONPATIENT_SECRET_CONFIGURED: !!process.env.ONPATIENT_CLIENT_SECRET,
});

function logChannel(name: string, channel: VendorChannel) {
  if (channel.status === 'disabled') {
    Logger.warn(
      `${name} service disabled: set ${channel.enableWith.join(' or ')} to enable.`,
    );
  } else {
    Logger.log(`${name} service enabled (${channel.status}).`);
  }
}

logChannel('Epic R4', vendors.epicR4);
logChannel('Epic DSTU2', vendors.epicDstu2);
logChannel('Cerner', vendors.cerner);
logChannel('Veradigm', vendors.veradigm);
logChannel('OnPatient', vendors.onpatient);
logChannel('Healow', vendors.healow);
logChannel('Athena', vendors.athena);
if (vendors.healow.status !== 'disabled') {
  Logger.log(
    process.env.HEALOW_CLIENT_SECRET
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
  imports.push(
    OnPatientModule.register({
      clientId: process.env.ONPATIENT_CLIENT_ID!,
      clientSecret: process.env.ONPATIENT_CLIENT_SECRET!,
      redirectUri: `${process.env.PUBLIC_URL}/api/v1/onpatient/callback`,
    }),
  );
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

@Module({
  imports,
  controllers: [AppController],
})
export class AppModule {}
