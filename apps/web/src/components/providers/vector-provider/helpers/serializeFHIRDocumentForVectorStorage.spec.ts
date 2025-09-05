import { serializeFHIRDocumentForVectorStorage } from './prepareClinicalDocumentForVectorization';
import { DocMeta } from '../providers/VectorStorageProvider';

// Mock crypto.randomUUID for consistent test results
beforeEach(() => {
  Object.defineProperty(global, 'crypto', {
    value: {
      randomUUID: jest.fn(() => 'mock-uuid'),
    },
    writable: true,
  });
});

describe('serializeFHIRDocumentForVectorStorage', () => {
  describe('FHIR field removal', () => {
    it('should remove link, fullUrl, and search fields', () => {
      const input = {
        link: [{ relation: 'self', url: 'http://example.com' }],
        fullUrl: 'http://example.com/resource',
        search: { mode: 'match' },
        actualData: 'keepThis',
      };
      
      const meta: DocMeta = { 
        category: 'observation',
        document_type: 'clinical_document',
        id: 'test-id',
        documentId: 'doc-123',
        connectionId: 'conn-456',
      };
      
      const result = serializeFHIRDocumentForVectorStorage(input, meta);
      
      expect(result.text).toBe('keepThis');
      expect(result.text).not.toContain('http://example.com');
      expect(result.text).not.toContain('match');
    });

    it('should remove resource metadata fields when present', () => {
      const input = {
        resource: {
          resourceType: 'Observation',
          id: 'obs-123',
          status: 'final',
          category: [{ coding: [{ code: 'lab' }] }],
          subject: { reference: 'Patient/123' },
          identifier: [{ system: 'http://example.com', value: '123' }],
          code: { text: 'Blood pressure' },
          value: '120/80',
        },
      };
      
      const meta: DocMeta = {
        category: 'observation',
        document_type: 'clinical_document',
        id: 'test-id',
        documentId: 'doc-123',
      };
      const result = serializeFHIRDocumentForVectorStorage(input, meta);
      
      // Should contain clinical data
      expect(result.text).toContain('Observation');
      expect(result.text).toContain('Blood pressure');
      expect(result.text).toContain('120/80');
      
      // Should not contain metadata
      expect(result.text).not.toContain('obs-123');
      expect(result.text).not.toContain('final');
      expect(result.text).not.toContain('lab');
      expect(result.text).not.toContain('Patient/123');
    });
  });

  describe('data serialization', () => {
    it('should flatten nested structures and join with pipe delimiter', () => {
      const input = {
        resourceType: 'Patient',
        name: {
          given: 'John',
          family: 'Doe',
        },
        address: {
          city: 'Boston',
          state: 'MA',
        },
      };
      
      const meta: DocMeta = {
        category: 'patient',
        document_type: 'clinical_document',
        id: 'test-id',
        documentId: 'patient-123',
      };
      const result = serializeFHIRDocumentForVectorStorage(input, meta);
      
      // Values should be joined with pipe (order may vary due to Set uniqueness)
      expect(result.text.split('|').sort()).toEqual(['Boston', 'Doe', 'John', 'MA', 'Patient'].sort());
    });

    it('should extract unique values only', () => {
      const input = {
        value1: 'duplicate',
        value2: 'duplicate',
        value3: 'unique',
        nested: {
          value4: 'duplicate',
        },
      };
      
      const meta: DocMeta = {
        category: 'observation',
        document_type: 'clinical_document',
        id: 'test-id',
        documentId: 'doc-123',
      };
      const result = serializeFHIRDocumentForVectorStorage(input, meta);
      
      // 'duplicate' should appear only once
      const duplicateCount = (result.text.match(/duplicate/g) || []).length;
      expect(duplicateCount).toBe(1);
      expect(result.text).toBe('duplicate|unique');
    });

    it('should sort object keys for consistent output', () => {
      const input1 = { z: 'last', a: 'first', m: 'middle' };
      const input2 = { a: 'first', m: 'middle', z: 'last' };
      
      const meta: DocMeta = {
        category: 'observation',
        document_type: 'clinical_document',
        id: 'test-id',
        documentId: 'doc-123',
      };
      
      const result1 = serializeFHIRDocumentForVectorStorage(input1, meta);
      const result2 = serializeFHIRDocumentForVectorStorage(input2, meta);
      
      // Both should produce identical output
      expect(result1.text).toBe(result2.text);
      // Check values are present (order may vary)
      expect(result1.text.split('|').sort()).toEqual(['first', 'last', 'middle'].sort());
    });

    it('should respect MAX_CHARS limit', () => {
      const longValue = 'x'.repeat(20000);
      const input = { 
        field1: longValue,
        field2: 'short',
      };
      
      const meta: DocMeta = {
        category: 'observation',
        document_type: 'clinical_document',
        id: 'test-id',
        documentId: 'doc-123',
      };
      const result = serializeFHIRDocumentForVectorStorage(input, meta);
      
      // After sorting keys alphabetically, field1 comes before field2
      // So the long value comes first, then 'short' is joined with '|'
      // The result is truncated to MAX_CHARS (18000)
      expect(result.text.length).toBe(18000);
      expect(result.text.startsWith('xxxx')).toBe(true); // Long value comes first
      expect(result.text).toContain('xxxx'); // Should contain the long value
      // Since the long value is 20000 chars and we truncate at 18000, 'short' won't appear
      expect(result.text).not.toContain('short');
    });
  });

  describe('metadata handling', () => {
    it('should generate chunk ID using documentId', () => {
      const input = { data: 'test' };
      const meta: DocMeta = { 
        category: 'observation',
        document_type: 'clinical_document',
        id: 'test-id',
        documentId: 'doc-456',
        connectionId: 'conn-789',
      };
      
      const result = serializeFHIRDocumentForVectorStorage(input, meta);
      
      expect(result.id).toBe('doc-456__chunk_0');
    });

    it('should use meta.id if documentId is not available', () => {
      const input = { data: 'test' };
      const meta: DocMeta = { 
        category: 'observation',
        document_type: 'clinical_document',
        id: 'fallback-id',
        connectionId: 'conn-789',
      };
      
      const result = serializeFHIRDocumentForVectorStorage(input, meta);
      
      expect(result.id).toBe('fallback-id__chunk_0');
    });

    it('should enrich metadata with chunk information', () => {
      const input = { data: 'test' };
      const meta: DocMeta = { 
        category: 'observation',
        document_type: 'clinical_document',
        id: 'test-id',
        documentId: 'doc-123',
        connectionId: 'conn-456',
        customField: 'customValue',
      };
      
      const result = serializeFHIRDocumentForVectorStorage(input, meta);
      
      expect(result.metadata).toEqual({
        category: 'observation',
        document_type: 'clinical_document',
        id: 'test-id',
        documentId: 'doc-123',
        connectionId: 'conn-456',
        customField: 'customValue',
        chunkNumber: 0,
        isFullDocument: false,
      });
    });
  });

  describe('edge cases', () => {
    it('should handle empty objects', () => {
      const input = {};
      const meta: DocMeta = {
        category: 'observation',
        document_type: 'clinical_document',
        id: 'test-id',
        documentId: 'empty-doc',
      };
      
      const result = serializeFHIRDocumentForVectorStorage(input, meta);
      
      // flattenObject returns { '': {} } for empty objects
      // Then Object.values gives [{}], which when stringified becomes '{}'
      expect(result.text).toBe('[object Object]');
      expect(result.id).toBe('empty-doc__chunk_0');
    });

    it('should handle null and undefined values', () => {
      const input = {
        nullValue: null,
        undefinedValue: undefined,
        validValue: 'test',
      };
      
      const meta: DocMeta = {
        category: 'observation',
        document_type: 'clinical_document',
        id: 'test-id',
        documentId: 'doc-123',
      };
      const result = serializeFHIRDocumentForVectorStorage(input, meta);
      
      // flattenObject handles null/undefined as values
      expect(result.text).toContain('test');
    });

    it('should handle arrays in the document', () => {
      const input = {
        codes: ['code1', 'code2', 'code3'],
        values: [100, 200, 300],
      };
      
      const meta: DocMeta = {
        category: 'observation',
        document_type: 'clinical_document',
        id: 'test-id',
        documentId: 'doc-123',
      };
      const result = serializeFHIRDocumentForVectorStorage(input, meta);
      
      // All array values should be included
      expect(result.text).toContain('code1');
      expect(result.text).toContain('code2');
      expect(result.text).toContain('code3');
      expect(result.text).toContain('100');
      expect(result.text).toContain('200');
      expect(result.text).toContain('300');
    });

    it('should not mutate the original input', () => {
      const input = {
        link: 'should be removed',
        resource: {
          id: 'should be removed',
          data: 'should remain',
        },
      };
      
      const originalCopy = JSON.parse(JSON.stringify(input));
      const meta: DocMeta = {
        category: 'observation',
        document_type: 'clinical_document',
        id: 'test-id',
        documentId: 'doc-123',
      };
      
      serializeFHIRDocumentForVectorStorage(input, meta);
      
      // Original should be unchanged
      expect(input).toEqual(originalCopy);
    });
  });

  describe('real-world FHIR examples', () => {
    it('should serialize FHIR Observation correctly', () => {
      const observation = {
        fullUrl: 'https://fhir.example.com/Observation/123',
        resource: {
          resourceType: 'Observation',
          id: 'obs-123',
          status: 'final',
          category: [{ 
            coding: [{ 
              system: 'http://terminology.hl7.org/CodeSystem/observation-category',
              code: 'laboratory',
            }],
          }],
          code: {
            coding: [{
              system: 'http://loinc.org',
              code: '29463-7',
              display: 'Body Weight',
            }],
          },
          valueQuantity: {
            value: 70,
            unit: 'kg',
            system: 'http://unitsofmeasure.org',
          },
          effectiveDateTime: '2024-01-15T10:30:00Z',
        },
      };
      
      const meta: DocMeta = { 
        category: 'observation',
        document_type: 'clinical_document',
        id: 'test-id',
        documentId: 'obs-doc-456',
        resourceType: 'Observation',
      };
      
      const result = serializeFHIRDocumentForVectorStorage(observation, meta);
      
      // Should contain clinical data
      expect(result.text).toContain('Observation');
      expect(result.text).toContain('29463-7');
      expect(result.text).toContain('Body Weight');
      expect(result.text).toContain('70');
      expect(result.text).toContain('kg');
      expect(result.text).toContain('2024-01-15T10:30:00Z');
      
      // Should not contain removed fields
      expect(result.text).not.toContain('obs-123');
      expect(result.text).not.toContain('final');
      expect(result.text).not.toContain('laboratory');
    });

    it('should serialize FHIR Patient correctly', () => {
      const patient = {
        resource: {
          resourceType: 'Patient',
          id: 'patient-789',
          identifier: [{ value: 'MRN123456' }],
          name: [{
            use: 'official',
            family: 'Smith',
            given: ['John', 'Jacob'],
          }],
          gender: 'male',
          birthDate: '1980-05-15',
          address: [{
            city: 'Boston',
            state: 'MA',
            postalCode: '02101',
          }],
        },
      };
      
      const meta: DocMeta = {
        category: 'patient',
        document_type: 'clinical_document',
        id: 'test-id',
        documentId: 'patient-doc-789',
      };
      const result = serializeFHIRDocumentForVectorStorage(patient, meta);
      
      // Should contain demographic data
      expect(result.text).toContain('Patient');
      expect(result.text).toContain('Smith');
      expect(result.text).toContain('John');
      expect(result.text).toContain('Jacob');
      expect(result.text).toContain('male');
      expect(result.text).toContain('1980-05-15');
      expect(result.text).toContain('Boston');
      expect(result.text).toContain('MA');
      expect(result.text).toContain('02101');
      
      // Should not contain identifier
      expect(result.text).not.toContain('MRN123456');
      expect(result.text).not.toContain('patient-789');
    });
  });
});