import { Test } from '@nestjs/testing';
import { AthenaModule } from './athena/athena.module';
import { CernerModule } from './cerner/cerner.module';
import { EpicModule } from './epic/epic.module';
import { HealowModule } from './healow/healow.module';
import { OnPatientModule } from './onpatient/onpatient.module';
import { LoginProxyModule } from './proxy/proxy.module';
import { VeradigmModule } from './veradigm/veradigm.module';

describe('vendor module wiring', () => {
  it.each([
    ['Epic', EpicModule],
    ['Cerner', CernerModule],
    ['Veradigm', VeradigmModule],
    ['Healow', HealowModule],
    ['Athena', AthenaModule],
    ['LoginProxy', LoginProxyModule],
  ])('%s module compiles standalone', async (_name, module) => {
    await expect(
      Test.createTestingModule({ imports: [module] }).compile(),
    ).resolves.toBeDefined();
  });

  it('OnPatient module compiles standalone', async () => {
    await expect(
      Test.createTestingModule({
        imports: [
          OnPatientModule.register({
            clientId: 'onpatient-client-id',
            clientSecret: 'onpatient-client-secret',
            publicUrl: 'https://app.example.com',
          }),
        ],
      }).compile(),
    ).resolves.toBeDefined();
  });
});
