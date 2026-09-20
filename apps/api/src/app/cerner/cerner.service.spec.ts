import { CernerService } from './cerner.service';
import {
  SeededTenantDb,
  openSeededTenantDb,
} from '../tenant-db/tenant-db.fixture';

describe('CernerService', () => {
  let seeded: SeededTenantDb;
  let service: CernerService;

  beforeEach(async () => {
    seeded = await openSeededTenantDb([
      {
        tenantId: 'cerner-dstu2-1',
        vendor: 'cerner',
        fhirVersion: 'DSTU2',
        name: 'Abbeville General Hospital',
        url: 'https://cerner.example.org/dstu2/abbeville/',
        token: 'https://cerner.example.org/abbeville/token',
        authorize: 'https://cerner.example.org/abbeville/authorize',
      },
      {
        tenantId: 'cerner-dstu2-2',
        vendor: 'cerner',
        fhirVersion: 'DSTU2',
        name: 'San Diego Clinic',
        url: 'https://cerner.example.org/dstu2/san-diego/',
        token: 'https://cerner.example.org/san-diego/token',
        authorize: 'https://cerner.example.org/san-diego/authorize',
      },
      {
        tenantId: 'cerner-r4-1',
        vendor: 'cerner',
        fhirVersion: 'R4',
        name: 'Abbeville General Hospital',
        url: 'https://cerner.example.org/r4/abbeville/',
        token: 'https://cerner.example.org/abbeville/token',
        authorize: 'https://cerner.example.org/abbeville/authorize',
      },
      {
        tenantId: 'epic-r4-1',
        vendor: 'epic',
        fhirVersion: 'R4',
        name: 'Abbeville Epic Clinic',
        url: 'https://epic.example.org/api/FHIR/R4/',
        token: 'https://epic.example.org/oauth2/token',
        authorize: 'https://epic.example.org/oauth2/authorize',
      },
    ]);
    service = new CernerService(seeded.db);
  });

  afterEach(async () => {
    await seeded.close();
  });

  describe('queryTenants (DSTU2)', () => {
    it('lists DSTU2 tenants by name when the query is empty', async () => {
      const result = await service.queryTenants('');

      expect(result).toEqual([
        {
          id: 'cerner-dstu2-1',
          url: 'https://cerner.example.org/dstu2/abbeville/',
          name: 'Abbeville General Hospital',
          token: 'https://cerner.example.org/abbeville/token',
          authorize: 'https://cerner.example.org/abbeville/authorize',
          managingOrganization: undefined,
        },
        {
          id: 'cerner-dstu2-2',
          url: 'https://cerner.example.org/dstu2/san-diego/',
          name: 'San Diego Clinic',
          token: 'https://cerner.example.org/san-diego/token',
          authorize: 'https://cerner.example.org/san-diego/authorize',
          managingOrganization: undefined,
        },
      ]);
    });

    it('returns only the matching tenant for a name query', async () => {
      const result = await service.queryTenants('abbeville');

      expect(result.map((tenant) => tenant.id)).toEqual(['cerner-dstu2-1']);
    });

    it('matches the same tenant when the query changes case', async () => {
      const result = await service.queryTenants('ABBEVILLE');

      expect(result.map((tenant) => tenant.id)).toEqual(['cerner-dstu2-1']);
    });

    it('matches a hyphenated query against a two-word name', async () => {
      const result = await service.queryTenants('san-diego');

      expect(result.map((tenant) => tenant.id)).toEqual(['cerner-dstu2-2']);
    });

    it('answers an unmatched query with an empty list', async () => {
      expect(await service.queryTenants('xyznonexistentquery')).toEqual([]);
    });

    it('treats an undefined query as empty', async () => {
      const result = await service.queryTenants(undefined as unknown as string);

      expect(result.map((tenant) => tenant.id)).toEqual([
        'cerner-dstu2-1',
        'cerner-dstu2-2',
      ]);
    });
  });

  describe('queryR4Tenants', () => {
    it('lists only R4 cerner tenants when the query is empty', async () => {
      const result = await service.queryR4Tenants('');

      expect(result).toEqual([
        {
          id: 'cerner-r4-1',
          url: 'https://cerner.example.org/r4/abbeville/',
          name: 'Abbeville General Hospital',
          token: 'https://cerner.example.org/abbeville/token',
          authorize: 'https://cerner.example.org/abbeville/authorize',
          managingOrganization: undefined,
        },
      ]);
    });

    it('never returns another vendor even when its name matches', async () => {
      const result = await service.queryR4Tenants('abbeville');

      expect(result.map((tenant) => tenant.id)).toEqual(['cerner-r4-1']);
    });
  });
});
