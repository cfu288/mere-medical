import { EpicService } from './epic.service';
import {
  SeededTenantDb,
  openSeededTenantDb,
} from '../tenant-db/tenant-db.fixture';

describe('EpicService', () => {
  let seeded: SeededTenantDb;
  let service: EpicService;

  beforeEach(() => {
    seeded = openSeededTenantDb([
      {
        tenantId: 'epic-dstu2-1',
        vendor: 'epic',
        fhirVersion: 'DSTU2',
        name: 'Access Community Health Network',
        url: 'https://epic.example.org/dstu2/access/',
        token: 'https://epic.example.org/access/oauth2/token',
        authorize: 'https://epic.example.org/access/oauth2/authorize',
      },
      {
        tenantId: 'sandbox_epic',
        vendor: 'epic',
        fhirVersion: 'DSTU2',
        name: 'Epic MyChart Sandbox',
        url: 'https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/DSTU2/',
        token: 'https://fhir.epic.com/interconnect-fhir-oauth/oauth2/token',
        authorize:
          'https://fhir.epic.com/interconnect-fhir-oauth/oauth2/authorize',
        source: 'sandbox',
      },
      {
        tenantId: 'epic-r4-1',
        vendor: 'epic',
        fhirVersion: 'R4',
        name: 'Billings OBGYN',
        url: 'https://epic.example.org/r4/billings/',
        token: 'https://epic.example.org/billings/oauth2/token',
        authorize: 'https://epic.example.org/billings/oauth2/authorize',
        managingOrganization: 'Intermountain Health',
      },
      {
        tenantId: 'sandbox_epic_r4',
        vendor: 'epic',
        fhirVersion: 'R4',
        name: 'Epic MyChart Sandbox (R4)',
        url: 'https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4/',
        token: 'https://fhir.epic.com/interconnect-fhir-oauth/oauth2/token',
        authorize:
          'https://fhir.epic.com/interconnect-fhir-oauth/oauth2/authorize',
        source: 'sandbox',
      },
      {
        tenantId: 'cerner-r4-1',
        vendor: 'cerner',
        fhirVersion: 'R4',
        name: 'Access Cerner Clinic',
        url: 'https://cerner.example.org/r4/access/',
        token: 'https://cerner.example.org/access/token',
        authorize: 'https://cerner.example.org/access/authorize',
      },
    ]);
    service = new EpicService(seeded.db);
  });

  afterEach(async () => {
    await seeded.close();
  });

  describe('queryTenants (DSTU2)', () => {
    it('lists DSTU2 tenants by name when the query is empty', async () => {
      const result = await service.queryTenants('');

      expect(result.map((tenant) => tenant.id)).toEqual([
        'epic-dstu2-1',
        'sandbox_epic',
      ]);
    });

    it('returns only the matching tenant for a name query', async () => {
      const result = await service.queryTenants('access');

      expect(result).toEqual([
        {
          id: 'epic-dstu2-1',
          url: 'https://epic.example.org/dstu2/access/',
          name: 'Access Community Health Network',
          token: 'https://epic.example.org/access/oauth2/token',
          authorize: 'https://epic.example.org/access/oauth2/authorize',
          managingOrganization: undefined,
        },
      ]);
    });

    it('returns only the sandbox row when sandboxOnly is true', async () => {
      const result = await service.queryTenants('', true);

      expect(result.map((tenant) => tenant.id)).toEqual(['sandbox_epic']);
    });

    it('returns production and sandbox rows when sandboxOnly is false', async () => {
      const result = await service.queryTenants('', false);

      expect(result.map((tenant) => tenant.id)).toEqual([
        'epic-dstu2-1',
        'sandbox_epic',
      ]);
    });
  });

  describe('queryR4Tenants', () => {
    it('lists R4 tenants by name when the query is empty', async () => {
      const result = await service.queryR4Tenants('');

      expect(result.map((tenant) => tenant.id)).toEqual([
        'epic-r4-1',
        'sandbox_epic_r4',
      ]);
    });

    it('matches a tenant by managing organization when its name differs', async () => {
      const result = await service.queryR4Tenants('intermountain');

      expect(result).toEqual([
        {
          id: 'epic-r4-1',
          url: 'https://epic.example.org/r4/billings/',
          name: 'Billings OBGYN',
          token: 'https://epic.example.org/billings/oauth2/token',
          authorize: 'https://epic.example.org/billings/oauth2/authorize',
          managingOrganization: 'Intermountain Health',
        },
      ]);
    });

    it('returns only the R4 sandbox row when sandboxOnly is true', async () => {
      const result = await service.queryR4Tenants('', true);

      expect(result.map((tenant) => tenant.id)).toEqual(['sandbox_epic_r4']);
    });

    it('never returns another vendor even when its name matches', async () => {
      const result = await service.queryR4Tenants('access');

      expect(result).toEqual([]);
    });
  });

  describe('edge cases', () => {
    it('treats an undefined query as empty', async () => {
      const result = await service.queryTenants(undefined as unknown as string);

      expect(result.map((tenant) => tenant.id)).toEqual([
        'epic-dstu2-1',
        'sandbox_epic',
      ]);
    });

    it('defaults sandboxOnly to false', async () => {
      const result = await service.queryTenants('');

      expect(result.map((tenant) => tenant.id)).toEqual([
        'epic-dstu2-1',
        'sandbox_epic',
      ]);
    });
  });
});
