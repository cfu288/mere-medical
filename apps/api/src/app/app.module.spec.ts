import type { TestingModule } from '@nestjs/testing';
import {
  SeededTenantDb,
  openSeededTenantDb,
} from './tenant-db/tenant-db.fixture';

describe('AppModule boot', () => {
  const originalEnv = process.env;
  let seeded: SeededTenantDb;

  beforeAll(async () => {
    seeded = await openSeededTenantDb([
      {
        tenantId: 'epic-1',
        vendor: 'epic',
        fhirVersion: 'R4',
        name: 'Mercy Health',
        url: 'https://epic.example.org/api/FHIR/R4/',
      },
    ]);
  });

  afterAll(async () => {
    await seeded.close();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it.each([
    ['no env vars set', {}],
    [
      'every vendor env blank',
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
      'every vendor configured',
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
      'unexpanded and malformed env values',
      {
        PUBLIC_URL: 'mereapp.com',
        ONPATIENT_CLIENT_ID: '$ONPATIENT_CLIENT_ID',
        EPIC_CLIENT_ID_R4: '$EPIC_CLIENT_ID_R4',
        CERNER_CLIENT_ID: '$CERNER_CLIENT_ID',
        ATHENA_SANDBOX_CLIENT_ID: '$ATHENA_SANDBOX_CLIENT_ID',
      },
    ],
  ])('the dependency graph boots with %s', async (_name, env) => {
    process.env = env as NodeJS.ProcessEnv;
    jest.resetModules();
    const { Test } = await import('@nestjs/testing');
    const { AppModule } = await import('./app.module');
    const { TENANT_DB } = await import('./tenant-db/tenant-db.module');
    const compiled: Promise<TestingModule> = Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(TENANT_DB)
      .useValue(seeded.db)
      .compile();
    await expect(compiled).resolves.toBeDefined();
  });
});
