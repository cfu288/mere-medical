import { Test, TestingModule } from '@nestjs/testing';
import { CernerService } from './cerner.service';

describe('CernerService', () => {
  let service: CernerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CernerService],
    }).compile();

    service = module.get<CernerService>(CernerService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('queryTenants (DSTU2)', () => {
    it('should return up to 100 tenants when query is empty', async () => {
      const result = await service.queryTenants('');

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
      expect(result.length).toBeLessThanOrEqual(100);
    });

    it('should return sorted results by name when query is empty', async () => {
      const result = await service.queryTenants('');

      for (let i = 1; i < result.length; i++) {
        expect(result[i - 1].name.localeCompare(result[i].name)).toBeLessThanOrEqual(0);
      }
    });

    it('should return up to 50 tenants when query is provided', async () => {
      const result = await service.queryTenants('clinic');

      expect(result.length).toBeLessThanOrEqual(50);
    });

    it('should filter results by query string', async () => {
      const result = await service.queryTenants('sandbox');

      expect(result.length).toBeGreaterThan(0);
      const hasMatchingName = result.some((tenant) =>
        tenant.name.toLowerCase().includes('sandbox')
      );
      expect(hasMatchingName).toBe(true);
    });

    it('should return results with required DSTU2 endpoint properties', async () => {
      const result = await service.queryTenants('');

      expect(result.length).toBeGreaterThan(0);
      const firstTenant = result[0];

      expect(firstTenant).toHaveProperty('id');
      expect(firstTenant).toHaveProperty('name');
      expect(firstTenant).toHaveProperty('url');
      expect(firstTenant).toHaveProperty('token');
      expect(firstTenant).toHaveProperty('authorize');
    });

    it('should handle queries with very low similarity scores', async () => {
      const result = await service.queryTenants('xyznonexistentquery');

      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('queryR4Tenants', () => {
    it('should return R4 tenants', async () => {
      const result = await service.queryR4Tenants('');

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
    });

    it('should return up to 100 tenants when query is empty', async () => {
      const result = await service.queryR4Tenants('');

      expect(result.length).toBeLessThanOrEqual(100);
    });

    it('should return sorted results by name when query is empty', async () => {
      const result = await service.queryR4Tenants('');

      for (let i = 1; i < result.length; i++) {
        expect(result[i - 1].name.localeCompare(result[i].name)).toBeLessThanOrEqual(0);
      }
    });

    it('should return up to 50 tenants when query is provided', async () => {
      const result = await service.queryR4Tenants('clinic');

      expect(result.length).toBeLessThanOrEqual(50);
    });

    it('should filter R4 results by query string', async () => {
      const result = await service.queryR4Tenants('sandbox');

      expect(result.length).toBeGreaterThan(0);
      const hasMatchingName = result.some((tenant) =>
        tenant.name.toLowerCase().includes('sandbox')
      );
      expect(hasMatchingName).toBe(true);
    });

    it('should return R4 endpoint with correct URL structure', async () => {
      const result = await service.queryR4Tenants('sandbox');

      expect(result.length).toBeGreaterThan(0);
      const sandboxEndpoint = result.find((t) =>
        t.name.toLowerCase().includes('sandbox')
      );

      if (sandboxEndpoint) {
        expect(sandboxEndpoint.url).toContain('/r4/');
      }
    });

    it('should return results with required R4 endpoint properties', async () => {
      const result = await service.queryR4Tenants('');

      expect(result.length).toBeGreaterThan(0);
      const firstTenant = result[0];

      expect(firstTenant).toHaveProperty('id');
      expect(firstTenant).toHaveProperty('name');
      expect(firstTenant).toHaveProperty('url');
      expect(firstTenant).toHaveProperty('token');
      expect(firstTenant).toHaveProperty('authorize');
    });
  });

  describe('edge cases', () => {
    it('should handle undefined query as empty', async () => {
      const result = await service.queryTenants(undefined as any);

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
    });

    it('should handle special characters in query', async () => {
      const result = await service.queryTenants('san-diego');

      expect(Array.isArray(result)).toBe(true);
    });

    it('should handle case-insensitive search', async () => {
      const resultLower = await service.queryTenants('sandbox');
      const resultUpper = await service.queryTenants('SANDBOX');

      expect(resultLower.length).toBeGreaterThan(0);
      expect(resultUpper.length).toBeGreaterThan(0);
    });
  });
});
