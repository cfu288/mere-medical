import { Test, TestingModule } from '@nestjs/testing';
import { EpicService } from './epic.service';

describe('EpicService', () => {
  let service: EpicService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [EpicService],
    }).compile();

    service = module.get<EpicService>(EpicService);
  });

  describe('queryTenants (DSTU2)', () => {
    it('should return sorted results by name when query is empty', async () => {
      const result = await service.queryTenants('');

      for (let i = 1; i < result.length; i++) {
        expect(
          result[i - 1].name.localeCompare(result[i].name),
        ).toBeLessThanOrEqual(0);
      }
    });

    it('should filter results by query string', async () => {
      const result = await service.queryTenants('sandbox');

      expect(result.length).toBeGreaterThan(0);
      const hasMatchingName = result.some((tenant) =>
        tenant.name.toLowerCase().includes('sandbox'),
      );
      expect(hasMatchingName).toBe(true);
    });

    describe('sandboxOnly parameter', () => {
      it('should return only sandbox endpoints when sandboxOnly is true', async () => {
        const result = await service.queryTenants('', true);

        expect(result.length).toBe(1);
        expect(result[0].id).toBe('sandbox_epic');
        expect(result[0].name).toBe('Epic MyChart Sandbox');
      });

      it('should return all endpoints when sandboxOnly is false', async () => {
        const result = await service.queryTenants('', false);

        expect(result.length).toBeGreaterThan(1);
        const hasSandbox = result.some((t) => t.id === 'sandbox_epic');
        const hasProduction = result.some((t) => t.id !== 'sandbox_epic');
        expect(hasSandbox || hasProduction).toBe(true);
      });

      it('should return sandbox endpoint even with empty query when sandboxOnly is true', async () => {
        const result = await service.queryTenants('', true);

        expect(result.length).toBe(1);
        expect(result[0].id).toBe('sandbox_epic');
      });
    });
  });

  describe('queryR4Tenants', () => {
    it('should return sorted results by name when query is empty', async () => {
      const result = await service.queryR4Tenants('');

      for (let i = 1; i < result.length; i++) {
        expect(
          result[i - 1].name.localeCompare(result[i].name),
        ).toBeLessThanOrEqual(0);
      }
    });

    it('should filter R4 results by query string', async () => {
      const result = await service.queryR4Tenants('sandbox');

      expect(result.length).toBeGreaterThan(0);
      const hasMatchingName = result.some((tenant) =>
        tenant.name.toLowerCase().includes('sandbox'),
      );
      expect(hasMatchingName).toBe(true);
    });

    describe('sandboxOnly parameter', () => {
      it('should return only sandbox R4 endpoint when sandboxOnly is true', async () => {
        const result = await service.queryR4Tenants('', true);

        expect(result.length).toBe(1);
        expect(result[0].id).toBe('sandbox_epic_r4');
        expect(result[0].name).toBe('Epic MyChart Sandbox (R4)');
      });

      it('should return all R4 endpoints when sandboxOnly is false', async () => {
        const result = await service.queryR4Tenants('', false);

        expect(result.length).toBeGreaterThan(1);
      });

      it('should return sandbox R4 endpoint even with empty query when sandboxOnly is true', async () => {
        const result = await service.queryR4Tenants('', true);

        expect(result.length).toBe(1);
        expect(result[0].id).toBe('sandbox_epic_r4');
      });
    });
  });

  describe('edge cases', () => {
    it('should handle undefined query as empty', async () => {
      const result = await service.queryTenants(undefined as any);

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
    });

    it('should default sandboxOnly to false when not provided', async () => {
      const result = await service.queryTenants('');

      expect(result.length).toBeGreaterThan(1);
    });
  });
});
