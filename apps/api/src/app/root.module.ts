import { Logger, Module, ModuleMetadata } from '@nestjs/common';
import { OnPatientModule } from './onpatient/onpatient.module';
import { RootController } from './root.controller';
import { StaticModule } from './static.module';
import { LoginProxyModule } from './proxy/proxy.module';
import { CernerModule } from './cerner/cerner.module';

const imports: ModuleMetadata['imports'] = [
  StaticModule,
  LoginProxyModule,
  CernerModule,
];

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
  controllers: [RootController],
})
export class RootModule {}

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

  return check;
}
