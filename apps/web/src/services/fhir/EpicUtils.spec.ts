import {
  assertEpicTenantId,
  isEpicSandbox,
  EPIC_SANDBOX_IDS,
  resolveEpicFhirBaseUrl,
} from './EpicUtils';

describe('EpicUtils', () => {
  describe('EPIC_SANDBOX_IDS', () => {
    it('contains expected sandbox identifiers', () => {
      expect(EPIC_SANDBOX_IDS).toContain('sandbox_epic');
      expect(EPIC_SANDBOX_IDS).toContain('sandbox_epic_r4');
      expect(EPIC_SANDBOX_IDS).toHaveLength(2);
    });
  });

  describe('isEpicSandbox', () => {
    it('returns true for sandbox_epic', () => {
      expect(isEpicSandbox('sandbox_epic')).toBe(true);
    });

    it('returns true for sandbox_epic_r4', () => {
      expect(isEpicSandbox('sandbox_epic_r4')).toBe(true);
    });

    it('returns false for production epic IDs', () => {
      expect(isEpicSandbox('70c2d451-3325-eb11-9135-001dd8b71f1a')).toBe(false);
    });

    it('returns false for undefined', () => {
      expect(isEpicSandbox(undefined)).toBe(false);
    });

    it('returns false for empty string', () => {
      expect(isEpicSandbox('')).toBe(false);
    });
  });

  describe('assertEpicTenantId', () => {
    it('returns a real tenant id', () => {
      expect(assertEpicTenantId('1a5fe784-078b-ef11-91a4-0050568bc890')).toBe(
        '1a5fe784-078b-ef11-91a4-0050568bc890',
      );
    });

    it('rejects a connection saved before tenants were tracked', () => {
      expect(() => assertEpicTenantId(undefined)).toThrow(
        'Connection predates tenant tracking',
      );
    });

    it('rejects the string a missing id turns into through local storage', () => {
      expect(() => assertEpicTenantId('undefined')).toThrow(
        'Connection predates tenant tracking',
      );
    });
  });

  describe('resolveEpicFhirBaseUrl', () => {
    it('resolves the canonical base url from the tenant id', () => {
      expect(
        resolveEpicFhirBaseUrl({
          tenant_id: '1a5fe784-078b-ef11-91a4-0050568bc890',
          location: 'https://call.api.northwell.io',
        }),
      ).toBe('https://call.api.northwell.io/epic-proxy/api/fhir/R4/');
    });

    it('ignores a stored location that lost its path prefix', () => {
      expect(
        resolveEpicFhirBaseUrl({
          tenant_id: '2baa00f4-3236-f011-91f0-0050568bc890',
          location: 'https://webprd.ochin.org/api/FHIR/R4/',
        }),
      ).toBe('https://webprd.ochin.org/prd-fhir/MyChartAACI/api/FHIR/R4/');
    });

    it('resolves DSTU2 tenants from the same lookup', () => {
      expect(
        resolveEpicFhirBaseUrl({
          tenant_id: '989e0f4c-9813-e911-9126-001dd8b71f19',
          location: 'https://prd.lluh.org',
        }),
      ).toBe('https://prd.lluh.org/fhir/api/fhir/DSTU2/');
    });

    it('resolves the sandbox tenant from the endpoint list', () => {
      expect(
        resolveEpicFhirBaseUrl({
          tenant_id: 'sandbox_epic_r4',
          location: 'https://fhir.epic.com',
        }),
      ).toBe('https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4/');
    });

    it('falls back to the stored location for a tenant not in the endpoint list', () => {
      expect(
        resolveEpicFhirBaseUrl({
          tenant_id: 'not-a-published-tenant',
          location: 'https://self.hosted.example.org/custom/api/FHIR/R4/',
        }),
      ).toBe('https://self.hosted.example.org/custom/api/FHIR/R4/');
    });

    it('throws for an unpublished tenant whose stored location is only an origin', () => {
      expect(() =>
        resolveEpicFhirBaseUrl({
          tenant_id: 'not-a-published-tenant',
          location: 'https://epic.example',
        }),
      ).toThrow('Connection is missing a FHIR base URL');
    });

    it('throws for an unpublished tenant whose stored location is an origin with a trailing slash', () => {
      expect(() =>
        resolveEpicFhirBaseUrl({
          tenant_id: 'not-a-published-tenant',
          location: 'https://epic.example/',
        }),
      ).toThrow('Connection is missing a FHIR base URL');
    });

    it('resolves a published tenant even when the stored location is only an origin', () => {
      expect(
        resolveEpicFhirBaseUrl({
          tenant_id: '1a5fe784-078b-ef11-91a4-0050568bc890',
          location: 'https://call.api.northwell.io',
        }),
      ).toBe('https://call.api.northwell.io/epic-proxy/api/fhir/R4/');
    });

    it('refuses the same connection the reconnect flow would reuse', () => {
      const legacy = {
        tenant_id: 'not-a-published-tenant',
        location: 'https://legacy.example.org',
      };

      expect(() => resolveEpicFhirBaseUrl(legacy)).toThrow(
        'Connection is missing a FHIR base URL',
      );
    });

    it('falls back to the stored location when there is no tenant id', () => {
      expect(
        resolveEpicFhirBaseUrl({
          location: 'https://self.hosted.example.org/api/FHIR/R4/',
        }),
      ).toBe('https://self.hosted.example.org/api/FHIR/R4/');
    });
  });
});
