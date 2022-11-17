import { Logger, Module, ModuleMetadata } from '@nestjs/common';
import { OnPatientModule } from './onpatient/onpatient.module';
import { RootController } from './root.controller';
import { StaticModule } from './static.module';

const imports: ModuleMetadata['imports'] = [StaticModule];

if (checkIfOnPatientConfigured()) {
  imports.push(
    OnPatientModule.register({
      clientId: process.env.ONPATIENT_CLIENT_ID,
      clientSecret: process.env.ONPATIENT_CLIENT_SECRET,
      redirectUri: process.env.ONPATIENT_REDIRECT_URI,
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
    !!process.env.ONPATIENT_CLIENT_ID &&
    !!process.env.ONPATIENT_CLIENT_SECRET &&
    !!process.env.ONPATIENT_REDIRECT_URI;
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
  if (!process.env.ONPATIENT_REDIRECT_URI) {
    Logger.warn(
      'ONPATIENT_REDIRECT_URI was not provided: OnPatient services will be disabled.'
    );
  }
  return check;
}
