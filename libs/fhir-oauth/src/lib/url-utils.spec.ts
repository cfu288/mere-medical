import { extractRelativeFhirPath } from './url-utils';

describe('extractRelativeFhirPath', () => {
  describe('Epic R4 URLs', () => {
    const baseUrl = 'https://fhir.epic.com/api/FHIR/R4/';

    it('extracts resource path from absolute pagination URL', () => {
      const nextUrl = 'https://fhir.epic.com/api/FHIR/R4/Patient?page=2&_count=100';
      expect(extractRelativeFhirPath(nextUrl, baseUrl)).toBe('Patient?page=2&_count=100');
    });

    it('handles base URL without trailing slash', () => {
      const baseWithoutSlash = 'https://fhir.epic.com/api/FHIR/R4';
      const nextUrl = 'https://fhir.epic.com/api/FHIR/R4/Observation?patient=123&page=2';
      expect(extractRelativeFhirPath(nextUrl, baseWithoutSlash)).toBe('Observation?patient=123&page=2');
    });

    it('handles complex query parameters', () => {
      const nextUrl = 'https://fhir.epic.com/api/FHIR/R4/Observation?patient=123&category=laboratory&_count=50&page=3';
      expect(extractRelativeFhirPath(nextUrl, baseUrl)).toBe('Observation?patient=123&category=laboratory&_count=50&page=3');
    });

    it('handles URLs with no query parameters', () => {
      const nextUrl = 'https://fhir.epic.com/api/FHIR/R4/Patient';
      expect(extractRelativeFhirPath(nextUrl, baseUrl)).toBe('Patient');
    });
  });

  describe('Epic DSTU2 URLs', () => {
    const baseUrl = 'https://fhir.epic.com/api/FHIR/DSTU2/';

    it('extracts resource path from DSTU2 pagination URL', () => {
      const nextUrl = 'https://fhir.epic.com/api/FHIR/DSTU2/MedicationStatement?patient=abc&page=2';
      expect(extractRelativeFhirPath(nextUrl, baseUrl)).toBe('MedicationStatement?patient=abc&page=2');
    });
  });

  describe('Healow URLs', () => {
    const baseUrl = 'https://healow.com/apps/api/fhir/r4/';

    it('extracts resource path from Healow pagination URL', () => {
      const nextUrl = 'https://healow.com/apps/api/fhir/r4/Condition?patient=xyz&page=2';
      expect(extractRelativeFhirPath(nextUrl, baseUrl)).toBe('Condition?patient=xyz&page=2');
    });
  });

  describe('VA URLs', () => {
    const baseUrl = 'https://sandbox-api.va.gov/services/fhir/v0/r4/';

    it('extracts resource path from VA pagination URL', () => {
      const nextUrl = 'https://sandbox-api.va.gov/services/fhir/v0/r4/Immunization?patient=123&page=2';
      expect(extractRelativeFhirPath(nextUrl, baseUrl)).toBe('Immunization?patient=123&page=2');
    });
  });

  describe('edge cases', () => {
    it('handles encoded query parameters', () => {
      const baseUrl = 'https://fhir.example.com/api/';
      const nextUrl = 'https://fhir.example.com/api/Patient?name=John%20Doe&page=2';
      expect(extractRelativeFhirPath(nextUrl, baseUrl)).toBe('Patient?name=John%20Doe&page=2');
    });

    it('handles nested resource paths', () => {
      const baseUrl = 'https://fhir.example.com/';
      const nextUrl = 'https://fhir.example.com/Patient/123/$everything?page=2';
      expect(extractRelativeFhirPath(nextUrl, baseUrl)).toBe('Patient/123/$everything?page=2');
    });

    it('handles base URL that is just origin', () => {
      const baseUrl = 'https://fhir.example.com/';
      const nextUrl = 'https://fhir.example.com/Patient?page=2';
      expect(extractRelativeFhirPath(nextUrl, baseUrl)).toBe('Patient?page=2');
    });

    it('handles relative URLs', () => {
      const baseUrl = 'https://fhir.epic.com/api/FHIR/R4/';
      const nextUrl = 'Patient?page=2&_count=100';
      expect(extractRelativeFhirPath(nextUrl, baseUrl)).toBe('Patient?page=2&_count=100');
    });

    it('handles relative URLs with leading slash', () => {
      const baseUrl = 'https://fhir.epic.com/api/FHIR/R4/';
      const nextUrl = '/api/FHIR/R4/Patient?page=2';
      expect(extractRelativeFhirPath(nextUrl, baseUrl)).toBe('Patient?page=2');
    });
  });
});
