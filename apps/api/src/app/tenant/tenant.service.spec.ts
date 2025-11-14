import { Test, TestingModule } from '@nestjs/testing';
import { TenantService } from './tenant.service';

describe('TenantService', () => {
  let service: TenantService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TenantService],
    }).compile();

    service = module.get<TenantService>(TenantService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('queryTenants (DSTU2 only)', () => {
    it('should return only DSTU2 endpoints', async () => {
      const result = await service.queryTenants('', []);

      expect(result.length).toBeGreaterThan(0);
      result.forEach((tenant) => {
        expect(tenant).toHaveProperty('version');
        expect(tenant.version).toBe('DSTU2');
      });
    });

    it('should return up to 100 tenants when query is empty', async () => {
      const result = await service.queryTenants('', []);

      expect(result.length).toBeGreaterThan(0);
      expect(result.length).toBeLessThanOrEqual(100);
    });

    it('should return up to 50 tenants when query is provided', async () => {
      const result = await service.queryTenants('clinic', []);

      expect(result.length).toBeLessThanOrEqual(50);
    });

    it('should filter by single vendor (string)', async () => {
      const result = await service.queryTenants('', ['CERNER']);

      expect(result.length).toBeGreaterThan(0);
      result.forEach((tenant) => {
        expect(tenant.vendor).toBe('CERNER');
      });
    });

    it('should filter by multiple vendors (array)', async () => {
      const result = await service.queryTenants('', ['CERNER', 'EPIC']);

      expect(result.length).toBeGreaterThan(0);
      result.forEach((tenant) => {
        expect(['CERNER', 'EPIC']).toContain(tenant.vendor);
      });
    });

    it('should filter by vendor and query together', async () => {
      const result = await service.queryTenants('sandbox', ['CERNER']);

      expect(result.length).toBeGreaterThan(0);
      result.forEach((tenant) => {
        expect(tenant.vendor).toBe('CERNER');
      });

      const hasMatchingName = result.some((t) =>
        t.name.toLowerCase().includes('sandbox')
      );
      expect(hasMatchingName).toBe(true);
    });

    it('should return all vendors when vendor filter is empty', async () => {
      const result = await service.queryTenants('sandbox', []);

      expect(result.length).toBeGreaterThan(0);

      const vendors = new Set(result.map((t) => t.vendor));
      expect(vendors.size).toBeGreaterThan(1);
    });

    it('should include vendor field in all results', async () => {
      const result = await service.queryTenants('', []);

      result.forEach((tenant) => {
        expect(tenant).toHaveProperty('vendor');
        expect(['EPIC', 'CERNER', 'VERADIGM']).toContain(tenant.vendor);
      });
    });

    it('should include version field in all results', async () => {
      const result = await service.queryTenants('', []);

      result.forEach((tenant) => {
        expect(tenant).toHaveProperty('version');
        expect(tenant.version).toBe('DSTU2');
      });
    });
  });

  describe('queryR4Tenants', () => {
    it('should return only R4 endpoints', async () => {
      const result = await service.queryR4Tenants('', []);

      result.forEach((tenant) => {
        expect(tenant).toHaveProperty('version');
        expect(tenant.version).toBe('R4');
      });
    });

    it('should return up to 100 tenants when query is empty', async () => {
      const result = await service.queryR4Tenants('', []);

      expect(result.length).toBeLessThanOrEqual(100);
    });

    it('should return up to 50 tenants when query is provided', async () => {
      const result = await service.queryR4Tenants('clinic', []);

      expect(result.length).toBeLessThanOrEqual(50);
    });

    it('should filter by vendor (CERNER)', async () => {
      const result = await service.queryR4Tenants('', ['CERNER']);

      result.forEach((tenant) => {
        expect(tenant.vendor).toBe('CERNER');
        expect(tenant.version).toBe('R4');
      });
    });

    it('should filter by query string', async () => {
      const result = await service.queryR4Tenants('sandbox', []);

      const hasMatchingName = result.some((t) =>
        t.name.toLowerCase().includes('sandbox')
      );
      expect(hasMatchingName).toBe(true);
    });

    it('should include vendor and version fields in all results', async () => {
      const result = await service.queryR4Tenants('', []);

      result.forEach((tenant) => {
        expect(tenant).toHaveProperty('vendor');
        expect(tenant).toHaveProperty('version');
        expect(tenant.version).toBe('R4');
      });
    });
  });

  describe('queryAllTenants (unified DSTU2 + R4)', () => {
    it('should return both DSTU2 and R4 endpoints', async () => {
      const result = await service.queryAllTenants('sandbox', []);

      expect(result.length).toBeGreaterThan(0);

      const versions = new Set(result.map((t) => t.version));
      expect(versions.has('DSTU2')).toBe(true);
      expect(versions.has('R4')).toBe(true);
    });

    it('should return up to 100 tenants when query is empty', async () => {
      const result = await service.queryAllTenants('', []);

      expect(result.length).toBeGreaterThan(0);
      expect(result.length).toBeLessThanOrEqual(100);
    });

    it('should return up to 50 tenants when query is provided', async () => {
      const result = await service.queryAllTenants('clinic', []);

      expect(result.length).toBeLessThanOrEqual(50);
    });

    it('should filter by vendor across all versions', async () => {
      const result = await service.queryAllTenants('', ['CERNER']);

      expect(result.length).toBeGreaterThan(0);
      result.forEach((tenant) => {
        expect(tenant.vendor).toBe('CERNER');
      });

      const versions = new Set(result.map((t) => t.version));
      expect(versions.size).toBeGreaterThan(0);
    });

    it('should combine DSTU2 and R4 Cerner results when filtering by CERNER', async () => {
      const result = await service.queryAllTenants('sandbox', ['CERNER']);

      const dstu2Results = result.filter((t) => t.version === 'DSTU2');
      const r4Results = result.filter((t) => t.version === 'R4');

      result.forEach((tenant) => {
        expect(tenant.vendor).toBe('CERNER');
      });

      expect(dstu2Results.length + r4Results.length).toBe(result.length);
    });

    it('should include version field in all results', async () => {
      const result = await service.queryAllTenants('', []);

      result.forEach((tenant) => {
        expect(tenant).toHaveProperty('version');
        expect(['DSTU2', 'R4']).toContain(tenant.version);
      });
    });

    it('should include vendor field in all results', async () => {
      const result = await service.queryAllTenants('', []);

      result.forEach((tenant) => {
        expect(tenant).toHaveProperty('vendor');
        expect(['EPIC', 'CERNER', 'VERADIGM']).toContain(tenant.vendor);
      });
    });
  });

  describe('vendor filtering bug prevention', () => {
    it('should handle vendor as string without spreading into chars', async () => {
      const result = await service.queryTenants('', ['CERNER']);

      expect(result.length).toBeGreaterThan(0);
      result.forEach((tenant) => {
        expect(tenant.vendor).toBe('CERNER');
      });
    });

    it('should handle vendor as array correctly', async () => {
      const result = await service.queryTenants('', ['CERNER', 'EPIC']);

      expect(result.length).toBeGreaterThan(0);
      result.forEach((tenant) => {
        expect(['CERNER', 'EPIC']).toContain(tenant.vendor);
      });
    });

    it('should not match partial vendor strings', async () => {
      const result = await service.queryTenants('', ['CER']);

      expect(result.length).toBe(0);
    });
  });

  describe('edge cases', () => {
    it('should handle undefined query as empty', async () => {
      const result = await service.queryTenants(undefined as any, []);

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
    });

    it('should handle empty vendor array', async () => {
      const result = await service.queryTenants('sandbox', []);

      expect(result.length).toBeGreaterThan(0);

      const vendors = new Set(result.map((t) => t.vendor));
      expect(vendors.size).toBeGreaterThan(1);
    });

    it('should return empty array for non-existent vendor', async () => {
      const result = await service.queryTenants('', ['NONEXISTENT']);

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(0);
    });

    it('should handle queries with very low similarity scores', async () => {
      const result = await service.queryTenants('xyznonexistentquery', []);

      expect(Array.isArray(result)).toBe(true);
    });
  });
});
