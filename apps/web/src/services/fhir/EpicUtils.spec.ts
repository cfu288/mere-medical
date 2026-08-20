import {
  parseEpicTenantId,
  isEpicSandbox,
  EPIC_SANDBOX_IDS,
  parseEpicFhirBaseUrl,
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

  describe('parseEpicTenantId', () => {
    it('returns a real tenant id', () => {
      expect(parseEpicTenantId('1a5fe784-078b-ef11-91a4-0050568bc890')).toBe(
        '1a5fe784-078b-ef11-91a4-0050568bc890',
      );
    });

    it('rejects a connection saved before tenants were tracked', () => {
      expect(() => parseEpicTenantId(undefined)).toThrow(
        'Connection predates tenant tracking',
      );
    });

    it('rejects the string a missing id turns into through local storage', () => {
      expect(() => parseEpicTenantId('undefined')).toThrow(
        'Connection predates tenant tracking',
      );
    });
  });

  describe('parseEpicFhirBaseUrl', () => {
    it('returns a stored fhir base url', () => {
      expect(
        parseEpicFhirBaseUrl(
          'https://call.api.northwell.io/epic-proxy/api/fhir/R4/',
        ),
      ).toBe('https://call.api.northwell.io/epic-proxy/api/fhir/R4/');
    });

    it('keeps a lowercase fhir path segment verbatim', () => {
      expect(
        parseEpicFhirBaseUrl('https://prd.lluh.org/fhir/api/fhir/DSTU2/'),
      ).toBe('https://prd.lluh.org/fhir/api/fhir/DSTU2/');
    });

    it('rejects a stored location that is only an origin', () => {
      expect(() => parseEpicFhirBaseUrl('https://epic.example')).toThrow(
        'Connection is missing a FHIR base URL',
      );
    });

    it('rejects a stored location that is an origin with a trailing slash', () => {
      expect(() => parseEpicFhirBaseUrl('https://epic.example/')).toThrow(
        'Connection is missing a FHIR base URL',
      );
    });

    it('rejects a stored location that cannot be read', () => {
      expect(() => parseEpicFhirBaseUrl('not-a-url')).toThrow(
        'Connection has an unusable address',
      );
    });
  });
});
