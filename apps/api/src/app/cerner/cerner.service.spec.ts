import { Test, TestingModule } from '@nestjs/testing';
import { TenantDbModule } from '../tenant-db/tenant-db.module';

import { CernerService } from './cerner.service';

describe('CernerService', () => {
  let service: CernerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [TenantDbModule],
      providers: [CernerService],
    }).compile();

    service = module.get<CernerService>(CernerService);
  });

  describe('queryTenants (DSTU2)', () => {
    it('lists tenants by name when the query is empty', async () => {
      const result = await service.queryTenants('');

      expect(result.slice(0, 3).map((tenant) => tenant.name)).toEqual([
        "A Woman's Place, LLC",
        'Abbeville General Hospital',
        'AbbVie Inc.',
      ]);
    });

    it('filters results by query string', async () => {
      const result = await service.queryTenants('sandbox');

      expect(result.length).toBeGreaterThan(0);
      const hasMatchingName = result.some((tenant) =>
        tenant.name.toLowerCase().includes('sandbox'),
      );
      expect(hasMatchingName).toBe(true);
    });

    it('should handle queries with very low similarity scores', async () => {
      const result = await service.queryTenants('xyznonexistentquery');

      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('queryR4Tenants', () => {
    it('lists r4 tenants by name when the query is empty', async () => {
      const result = await service.queryR4Tenants('');

      expect(result.slice(0, 3).map((tenant) => tenant.name)).toEqual([
        "A Woman's Place, LLC",
        'Abbeville General Hospital',
        'ABHA MISHRA NEUROLOGY PLLC',
      ]);
    });

    it('filters R4 results by query string', async () => {
      const result = await service.queryR4Tenants('sandbox');

      expect(result.length).toBeGreaterThan(0);
      const hasMatchingName = result.some((tenant) =>
        tenant.name.toLowerCase().includes('sandbox'),
      );
      expect(hasMatchingName).toBe(true);
    });

    it('should return R4 endpoints with /r4/ in URL', async () => {
      const result = await service.queryR4Tenants('sandbox');

      expect(result.length).toBeGreaterThan(0);
      const sandboxEndpoint = result.find((t) =>
        t.name.toLowerCase().includes('sandbox'),
      );

      if (sandboxEndpoint) {
        expect(sandboxEndpoint.url).toContain('/r4/');
      }
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
