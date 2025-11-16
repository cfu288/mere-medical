import { resolveObservationReferences } from './fhirReferenceResolver';

describe('resolveObservationReferences', () => {
  describe('absolute URLs (Epic/Cerner R4 format)', () => {
    it('should return absolute URLs unchanged', () => {
      const references = [
        { reference: 'https://fhir-ehr-code.cerner.com/r4/tenant-id/Observation/123' },
        { reference: 'https://fhir.epic.com/api/FHIR/R4/Observation/456' },
      ];

      const result = resolveObservationReferences({
        references,
        baseUrl: 'https://example.com/fhir/',
      });

      expect(result).toEqual([
        'https://fhir-ehr-code.cerner.com/r4/tenant-id/Observation/123',
        'https://fhir.epic.com/api/FHIR/R4/Observation/456',
      ]);
    });

    it('should handle absolute URLs without baseUrl', () => {
      const references = [
        { reference: 'https://fhir.epic.com/api/FHIR/R4/Observation/789' },
      ];

      const result = resolveObservationReferences({
        references,
      });

      expect(result).toEqual([
        'https://fhir.epic.com/api/FHIR/R4/Observation/789',
      ]);
    });
  });

  describe('relative URLs (Veradigm format)', () => {
    it('should join relative URLs with baseUrl', () => {
      const references = [
        { reference: 'Observation/123' },
        { reference: 'Observation/456' },
      ];

      const result = resolveObservationReferences({
        references,
        baseUrl: 'https://fhir.veradigm.com/r4/tenant-id',
      });

      expect(result).toEqual([
        'https://fhir.veradigm.com/r4/tenant-id/Observation/123',
        'https://fhir.veradigm.com/r4/tenant-id/Observation/456',
      ]);
    });

    it('should handle baseUrl with trailing slash', () => {
      const references = [
        { reference: 'Observation/789' },
      ];

      const result = resolveObservationReferences({
        references,
        baseUrl: 'https://fhir-ehr-code.cerner.com/r4/ec2458f2-1e24-41c8-b71b-0e701af7583d/',
      });

      expect(result).toEqual([
        'https://fhir-ehr-code.cerner.com/r4/ec2458f2-1e24-41c8-b71b-0e701af7583d/Observation/789',
      ]);
    });

    it('should handle baseUrl without trailing slash', () => {
      const references = [
        { reference: 'Observation/ABC' },
      ];

      const result = resolveObservationReferences({
        references,
        baseUrl: 'https://fhir.example.com/r4/tenant',
      });

      expect(result).toEqual([
        'https://fhir.example.com/r4/tenant/Observation/ABC',
      ]);
    });

    it('should return relative URLs unchanged when baseUrl is missing', () => {
      const references = [
        { reference: 'Observation/123' },
      ];

      const result = resolveObservationReferences({
        references,
      });

      expect(result).toEqual([
        'Observation/123',
      ]);
    });
  });

  describe('mixed scenarios', () => {
    it('should handle mix of absolute and relative URLs', () => {
      const references = [
        { reference: 'https://fhir.epic.com/api/FHIR/R4/Observation/absolute1' },
        { reference: 'Observation/relative1' },
        { reference: 'https://fhir-ehr-code.cerner.com/r4/tenant/Observation/absolute2' },
        { reference: 'Observation/relative2' },
      ];

      const result = resolveObservationReferences({
        references,
        baseUrl: 'https://fhir.veradigm.com/r4/tenant-id',
      });

      expect(result).toEqual([
        'https://fhir.epic.com/api/FHIR/R4/Observation/absolute1',
        'https://fhir.veradigm.com/r4/tenant-id/Observation/relative1',
        'https://fhir-ehr-code.cerner.com/r4/tenant/Observation/absolute2',
        'https://fhir.veradigm.com/r4/tenant-id/Observation/relative2',
      ]);
    });
  });

  describe('edge cases', () => {
    it('should handle empty references array', () => {
      const result = resolveObservationReferences({
        references: [],
        baseUrl: 'https://example.com/fhir/',
      });

      expect(result).toEqual([]);
    });

    it('should handle undefined baseUrl gracefully', () => {
      const references = [
        { reference: 'https://fhir.epic.com/Observation/123' },
        { reference: 'Observation/456' },
      ];

      const result = resolveObservationReferences({
        references,
        baseUrl: undefined,
      });

      expect(result).toEqual([
        'https://fhir.epic.com/Observation/123',
        'Observation/456',
      ]);
    });

    it('should preserve https protocol in absolute URLs', () => {
      const references = [
        { reference: 'https://secure.fhir.com/r4/Observation/secure' },
      ];

      const result = resolveObservationReferences({
        references,
        baseUrl: 'http://example.com/fhir/',
      });

      expect(result).toEqual([
        'https://secure.fhir.com/r4/Observation/secure',
      ]);
    });

    it('should handle http protocol in absolute URLs', () => {
      const references = [
        { reference: 'http://local.fhir.com/r4/Observation/local' },
      ];

      const result = resolveObservationReferences({
        references,
        baseUrl: 'https://example.com/fhir/',
      });

      expect(result).toEqual([
        'http://local.fhir.com/r4/Observation/local',
      ]);
    });
  });

  describe('real-world vendor examples', () => {
    it('should handle Cerner R4 sandbox format', () => {
      const references = [
        { reference: 'Observation/M197198438' },
      ];

      const result = resolveObservationReferences({
        references,
        baseUrl: 'https://fhir-ehr-code.cerner.com/r4/ec2458f2-1e24-41c8-b71b-0e701af7583d/',
      });

      expect(result).toEqual([
        'https://fhir-ehr-code.cerner.com/r4/ec2458f2-1e24-41c8-b71b-0e701af7583d/Observation/M197198438',
      ]);
    });

    it('should handle Epic interconnect format', () => {
      const references = [
        { reference: 'https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4/Observation/eXYZ123' },
      ];

      const result = resolveObservationReferences({
        references,
        baseUrl: 'https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4/',
      });

      expect(result).toEqual([
        'https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4/Observation/eXYZ123',
      ]);
    });

    it('should handle Veradigm relative references', () => {
      const references = [
        { reference: 'Observation/12345' },
        { reference: 'Observation/67890' },
      ];

      const result = resolveObservationReferences({
        references,
        baseUrl: 'https://fhir.veradigm.com/r4/tenant-abc123',
      });

      expect(result).toEqual([
        'https://fhir.veradigm.com/r4/tenant-abc123/Observation/12345',
        'https://fhir.veradigm.com/r4/tenant-abc123/Observation/67890',
      ]);
    });
  });
});
