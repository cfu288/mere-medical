import type { TestingModule } from '@nestjs/testing';

describe('AppModule boot', () => {
  const originalEnv = process.env;

  afterEach(() => {
    process.env = originalEnv;
  });

  it.each([
    ['no', {}],
    [
      'blank',
      {
        PUBLIC_URL: '',
        ONPATIENT_CLIENT_ID: '',
        ONPATIENT_CLIENT_SECRET: '',
        EPIC_CLIENT_ID_R4: '',
        EPIC_CLIENT_ID_DSTU2: '',
        EPIC_SANDBOX_CLIENT_ID_R4: '',
        EPIC_SANDBOX_CLIENT_ID_DSTU2: '',
        CERNER_CLIENT_ID: '',
        VERADIGM_CLIENT_ID: '',
        HEALOW_CLIENT_ID: '',
        HEALOW_CLIENT_SECRET: '',
        ATHENA_CLIENT_ID: '',
        ATHENA_SANDBOX_CLIENT_ID: '',
      },
    ],
    [
      'full vendor',
      {
        PUBLIC_URL: 'https://stage.meremedical.co',
        ONPATIENT_CLIENT_ID: 'onpatient-client-id',
        ONPATIENT_CLIENT_SECRET: 'onpatient-client-secret',
        EPIC_CLIENT_ID_R4: 'epic-r4-client-id',
        EPIC_CLIENT_ID_DSTU2: 'epic-dstu2-client-id',
        EPIC_SANDBOX_CLIENT_ID_R4: 'epic-sandbox-r4-client-id',
        EPIC_SANDBOX_CLIENT_ID_DSTU2: 'epic-sandbox-dstu2-client-id',
        CERNER_CLIENT_ID: 'cerner-client-id',
        VERADIGM_CLIENT_ID: 'veradigm-client-id',
        HEALOW_CLIENT_ID: 'healow-client-id',
        HEALOW_CLIENT_SECRET: 'healow-client-secret',
        ATHENA_CLIENT_ID: 'athena-client-id',
        ATHENA_SANDBOX_CLIENT_ID: 'athena-sandbox-client-id',
      },
    ],
    [
      'adversarial',
      {
        PUBLIC_URL: 'mereapp.com',
        ONPATIENT_CLIENT_ID: '$ONPATIENT_CLIENT_ID',
        EPIC_CLIENT_ID_R4: '$EPIC_CLIENT_ID_R4',
        CERNER_CLIENT_ID: '$CERNER_CLIENT_ID',
        ATHENA_SANDBOX_CLIENT_ID: '$ATHENA_SANDBOX_CLIENT_ID',
      },
    ],
  ])('compiles with %s env', async (_name, env) => {
    process.env = env as NodeJS.ProcessEnv;
    jest.resetModules();
    const { Test } = require('@nestjs/testing');
    const { AppModule } = require('./app.module');
    const compiled: Promise<TestingModule> = Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    await expect(compiled).resolves.toBeDefined();
  });
});
