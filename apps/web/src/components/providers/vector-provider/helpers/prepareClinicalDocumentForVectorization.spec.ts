import { ClinicalDocument } from '../../../../models/clinical-document/ClinicalDocument.type';
import { prepareClinicalDocumentForVectorization } from './prepareClinicalDocumentForVectorization';
import { CHUNK_SIZE } from '../constants';

// Mock crypto.randomUUID for predictable testing
const mockUUIDs = [
  'mock-uuid-1',
  'mock-uuid-2',
  'mock-uuid-3',
  'mock-uuid-4',
  'mock-uuid-5',
  'mock-uuid-6',
  'mock-uuid-7',
  'mock-uuid-8',
  'mock-uuid-9',
  'mock-uuid-10',
];
let uuidIndex = 0;

beforeEach(() => {
  uuidIndex = 0;
  // Mock crypto.randomUUID
  Object.defineProperty(global, 'crypto', {
    value: {
      randomUUID: jest.fn(() => {
        const uuid = mockUUIDs[uuidIndex % mockUUIDs.length];
        uuidIndex++;
        return uuid;
      }),
    },
    writable: true,
  });
});

// Real test fixtures extracted from production demo.json
const realObservationFixture: ClinicalDocument<any> = {
  id: '3993ce6f-d2d6-4526-840d-4753b7207c88|91a8d8cb-6480-4db4-a628-18a5e44536cd|https://fhir.epic.com/interconnect-fhir-oauth/FHIR/DSTU2/Observation/T2tq0t9mgFFfQ8JWmyGaw7g8g1W3Yj3Zg.bSZtsIVGzoB',
  user_id: '91a8d8cb-6480-4db4-a628-18a5e44536cd',
  connection_record_id: '3993ce6f-d2d6-4526-840d-4753b7207c88',
  data_record: {
    raw: {
      link: [
        {
          relation: 'self',
          url: 'https://fhir.epic.com/interconnect-fhir-oauth/FHIR/DSTU2/Observation/T2tq0t9mgFFfQ8JWmyGaw7g8g1W3Yj3Zg.bSZtsIVGzoB',
        },
      ],
      fullUrl:
        'https://fhir.epic.com/interconnect-fhir-oauth/FHIR/DSTU2/Observation/T2tq0t9mgFFfQ8JWmyGaw7g8g1W3Yj3Zg.bSZtsIVGzoB',
      resource: {
        resourceType: 'Observation',
        id: 'T2tq0t9mgFFfQ8JWmyGaw7g8g1W3Yj3Zg.bSZtsIVGzoB',
        status: 'final',
        category: {
          coding: [
            {
              system: 'http://hl7.org/fhir/observation-category',
              code: 'laboratory',
              display: 'Laboratory',
            },
          ],
          text: 'Laboratory',
        },
        code: {
          coding: [
            {
              system: 'http://loinc.org',
              code: '1975-2',
              display: 'Bilirubin.total [Mass/volume] in Serum or Plasma',
            },
          ],
          text: 'BR- BILIRUBIN, TOTAL, SERUM',
        },
        subject: {
          display: 'Smith, John',
          reference:
            'https://fhir.epic.com/interconnect-fhir-oauth/FHIR/DSTU2/Patient/abe3196c-2f56-43e1-9fb1-cd78b4c3f270',
        },
        effectiveDateTime: '2012-04-12T11:50:26.663Z',
        valueQuantity: {
          value: 0.7,
          unit: 'mg/dL',
          system: 'http://unitsofmeasure.org',
          code: 'mg/dL',
        },
        referenceRange: [
          {
            text: '<1.2',
          },
        ],
      },
    },
    format: 'FHIR.DSTU2',
    content_type: 'application/json',
    resource_type: 'observation',
    version_history: [],
  },
  metadata: {
    id: 'https://fhir.epic.com/interconnect-fhir-oauth/FHIR/DSTU2/Observation/T2tq0t9mgFFfQ8JWmyGaw7g8g1W3Yj3Zg.bSZtsIVGzoB',
    date: '2012-04-12T11:50:26.663Z',
    display_name: 'BR- BILIRUBIN, TOTAL, SERUM',
    loinc_coding: ['1975-2'],
  },
};

const realConditionFixture: ClinicalDocument<any> = {
  id: '0f38582a-1773-4e2b-80e3-90fda727cdbd|91a8d8cb-6480-4db4-a628-18a5e44536cd|Condition/47026121',
  user_id: '91a8d8cb-6480-4db4-a628-18a5e44536cd',
  connection_record_id: '0f38582a-1773-4e2b-80e3-90fda727cdbd',
  data_record: {
    raw: {
      resource: {
        category: {
          text: 'Diagnosis',
          coding: [
            {
              code: 'diagnosis',
              system: 'http://hl7.org/fhir/condition-category',
              display: 'Diagnosis',
            },
          ],
        },
        code: {
          text: 'Cough, unspecified',
          coding: [
            {
              code: 'R05.9',
              system: 'http://hl7.org/fhir/sid/icd-10',
              display: 'Cough, unspecified',
            },
          ],
        },
        patient: {
          reference: 'Patient/1850092',
        },
        resourceType: 'Condition',
        dateRecorded: '2021-03-28',
        verificationStatus: 'confirmed',
        id: '47026121',
        clinicalStatus: 'active',
      },
      fullUrl: ['/api/fhir/Condition/47026121'],
    },
    format: 'FHIR.DSTU2',
    content_type: 'application/json',
    resource_type: 'condition',
    version_history: [],
  },
  metadata: {
    id: 'Condition/47026121',
    date: '2021-03-28',
    display_name: 'Cough, unspecified',
  },
};

describe('prepareClinicalDocumentForVectorization', () => {
  describe('chunk ID generation', () => {
    it('generates deterministic IDs for JSON documents', () => {
      const doc: ClinicalDocument<any> = {
        id: 'test-doc-123',
        user_id: 'user-456',
        connection_record_id: 'conn-789',
        data_record: {
          raw: { test: 'data' },
          format: 'FHIR.DSTU2',
          content_type: 'application/json',
          resource_type: 'observation',
          version_history: [],
        },
      };

      const result1 = prepareClinicalDocumentForVectorization(doc);
      const result2 = prepareClinicalDocumentForVectorization(doc);

      // Same document should always generate the same chunk IDs
      expect(result1.docList[0].id).toBe(result2.docList[0].id);
      expect(result1.docList[0].id).toBe('test-doc-123__chunk_0');
    });

    it('generates deterministic IDs for chunked XML documents', () => {
      const largeXmlContent = 'x'.repeat(CHUNK_SIZE + 1000);
      const doc: ClinicalDocument<any> = {
        id: 'xml-doc-456',
        user_id: 'user-123',
        connection_record_id: 'conn-123',
        data_record: {
          raw: largeXmlContent,
          format: 'FHIR.DSTU2',
          content_type: 'application/xml',
          resource_type: 'documentreference',
          version_history: [],
        },
      };

      const result = prepareClinicalDocumentForVectorization(doc);

      // Check that chunk IDs are deterministic and parsable
      expect(result.docList[0].id).toBe('xml-doc-456__chunk_0');
      expect(result.docList[1].id).toBe('xml-doc-456__chunk_1');

      // Running again should produce the same IDs
      const result2 = prepareClinicalDocumentForVectorization(doc);
      expect(result.docList[0].id).toBe(result2.docList[0].id);
      expect(result.docList[1].id).toBe(result2.docList[1].id);
    });
  });
  describe('lab observation serialization', () => {
    it('flattens FHIR observation extracting only resource fields', () => {
      const result = prepareClinicalDocumentForVectorization(
        realObservationFixture,
      );

      // flattenObject extracts only the resource content, not metadata like link/fullUrl
      const expectedText =
        'Observation|http://loinc.org|1975-2|Bilirubin.total [Mass/volume] in Serum or Plasma|BR- BILIRUBIN, TOTAL, SERUM|2012-04-12T11:50:26.663Z|0.7|mg/dL|http://unitsofmeasure.org|<1.2';

      expect(result.docList).toHaveLength(1);
      expect(result.docList[0].text).toBe(expectedText);

      // Verify fields that should be filtered out
      const text = result.docList[0].text;
      expect(text).not.toContain('link');
      expect(text).not.toContain('fullUrl');
      expect(text).not.toContain('T2tq0t9mgFFfQ8JWmyGaw7g8g1W3Yj3Zg'); // resource.id
      expect(text).not.toContain('Smith, John'); // subject.display
      expect(text).not.toContain('Patient'); // subject.reference
      expect(text).not.toContain('final'); // status
      expect(text).not.toContain('Laboratory'); // category.text
      expect(text).not.toContain('laboratory'); // category.coding.code

      // Verify metadata is preserved separately
      expect(result.metaList[0]).toEqual({
        category: 'observation',
        document_type: 'clinical_document',
        id: realObservationFixture.id,
        url: 'https://fhir.epic.com/interconnect-fhir-oauth/FHIR/DSTU2/Observation/T2tq0t9mgFFfQ8JWmyGaw7g8g1W3Yj3Zg.bSZtsIVGzoB',
        documentId: realObservationFixture.id,
        user_id: '91a8d8cb-6480-4db4-a628-18a5e44536cd',
        chunkNumber: 0,
        isFullDocument: false,
      });
    });

    it('filters out FHIR wrapper fields while preserving clinical data', () => {
      const simpleObs: ClinicalDocument<any> = {
        id: 'test-obs',
        user_id: 'test-user',
        connection_record_id: 'test-conn',
        data_record: {
          raw: {
            link: [{ relation: 'self', url: 'http://example.com' }],
            fullUrl: 'http://example.com/Observation/123',
            resource: {
              resourceType: 'Observation',
              id: 'obs-123',
              meta: { versionId: '1', lastUpdated: '2024-01-01' },
              status: 'final',
              code: { text: 'Glucose' },
              valueQuantity: { value: 100, unit: 'mg/dL' },
            },
          },
          format: 'FHIR.DSTU2',
          content_type: 'application/json',
          resource_type: 'observation',
          version_history: [],
        },
      };

      const result = prepareClinicalDocumentForVectorization(simpleObs);
      const text = result.docList[0].text;

      // Should include clinical content
      expect(text).toContain('Observation');
      expect(text).toContain('Glucose');
      expect(text).toContain('100');
      expect(text).toContain('mg/dL');

      // Should NOT include FHIR metadata/wrapper fields
      expect(text).not.toContain('link');
      expect(text).not.toContain('fullUrl');
      expect(text).not.toContain('http://example.com');
      expect(text).not.toContain('obs-123');
      expect(text).not.toContain('versionId');
      expect(text).not.toContain('lastUpdated');
      expect(text).not.toContain('final');
    });
  });

  describe('condition serialization', () => {
    it('flattens FHIR condition with ICD-10 codes', () => {
      const result =
        prepareClinicalDocumentForVectorization(realConditionFixture);

      const expectedText =
        'Cough, unspecified|R05.9|http://hl7.org/fhir/sid/icd-10|Patient/1850092|Condition|2021-03-28|confirmed|active';

      expect(result.docList[0].text).toBe(expectedText);

      expect(result.metaList[0]).toEqual({
        category: 'condition',
        document_type: 'clinical_document',
        id: realConditionFixture.id,
        url: 'Condition/47026121',
        documentId: realConditionFixture.id,
        user_id: '91a8d8cb-6480-4db4-a628-18a5e44536cd',
        chunkNumber: 0,
        isFullDocument: false,
      });
    });

    it('filters out category field from condition resources', () => {
      const result =
        prepareClinicalDocumentForVectorization(realConditionFixture);
      const text = result.docList[0].text;

      expect(text).not.toContain('Diagnosis');
      expect(text).not.toContain('diagnosis');
      expect(text).not.toContain('http://hl7.org/fhir/condition-category');
    });

    it('filters out id and status fields from condition resources', () => {
      const result =
        prepareClinicalDocumentForVectorization(realConditionFixture);
      const text = result.docList[0].text;

      expect(text).not.toContain('47026121');
      expect(text).not.toContain('/api/fhir/Condition/47026121');
    });

    it('filters out fullUrl wrapper field', () => {
      const result =
        prepareClinicalDocumentForVectorization(realConditionFixture);
      const text = result.docList[0].text;

      expect(text).not.toContain('/api/fhir/Condition/47026121');
      expect(text).not.toContain('fullUrl');
    });
  });

  describe('UUID generation', () => {
    it('assigns sequential UUIDs to chunks', () => {
      const doc: ClinicalDocument<any> = {
        id: 'doc-123',
        user_id: 'user-456',
        connection_record_id: 'conn-789',
        data_record: {
          raw: { simple: 'data' },
          format: 'FHIR.DSTU2',
          content_type: 'application/json',
          resource_type: 'observation',
          version_history: [],
        },
      };

      const result = prepareClinicalDocumentForVectorization(doc);

      expect(result.docList[0].id).toBe('doc-123__chunk_0');
    });
  });

  describe('FHIR JSON resource flattening', () => {
    it('extracts key clinical data from nested FHIR structures', () => {
      const doc: ClinicalDocument<any> = {
        id: 'doc-json',
        user_id: 'user-123',
        connection_record_id: 'conn-123',
        data_record: {
          raw: {
            resourceType: 'Observation',
            id: 'obs-123',
            status: 'final',
            code: {
              text: 'Blood Pressure',
              coding: [
                {
                  system: 'http://loinc.org',
                  code: '55284-4',
                  display: 'Blood pressure systolic and diastolic',
                },
              ],
            },
            component: [
              {
                code: {
                  coding: [
                    {
                      system: 'http://loinc.org',
                      code: '8480-6',
                      display: 'Systolic blood pressure',
                    },
                  ],
                },
                valueQuantity: {
                  value: 120,
                  unit: 'mmHg',
                  system: 'http://unitsofmeasure.org',
                  code: 'mm[Hg]',
                },
              },
              {
                code: {
                  coding: [
                    {
                      system: 'http://loinc.org',
                      code: '8462-4',
                      display: 'Diastolic blood pressure',
                    },
                  ],
                },
                valueQuantity: {
                  value: 80,
                  unit: 'mmHg',
                  system: 'http://unitsofmeasure.org',
                  code: 'mm[Hg]',
                },
              },
            ],
            effectiveDateTime: '2024-01-15T09:30:00Z',
            issued: '2024-01-15T09:35:00Z',
          },
          format: 'FHIR.DSTU2',
          content_type: 'application/json',
          resource_type: 'observation',
          version_history: [],
        },
      };

      const result = prepareClinicalDocumentForVectorization(doc);

      expect(result.docList).toHaveLength(1);
      expect(result.docList[0].text).toContain('Observation');
      expect(result.docList[0].text).toContain('Blood Pressure');
      expect(result.docList[0].text).toContain('55284-4'); // LOINC code
      expect(result.docList[0].text).toContain('120'); // Systolic
      expect(result.docList[0].text).toContain('80'); // Diastolic
      expect(result.docList[0].text).toContain('mmHg');

      expect(result.metaList).toHaveLength(1);
      expect(result.metaList[0].documentId).toBe('doc-json');
      expect(result.metaList[0].category).toBe('observation');
      expect(result.metaList[0].user_id).toBe('user-123');
    });
  });

  describe('XML document chunking', () => {
    it('chunks large XML documents with proper overlap', () => {
      const largeXmlContent = 'x'.repeat(CHUNK_SIZE + 1000);
      const doc: ClinicalDocument<any> = {
        id: 'doc-xml-large',
        user_id: 'user-123',
        connection_record_id: 'conn-123',
        data_record: {
          raw: largeXmlContent,
          format: 'FHIR.DSTU2',
          content_type: 'application/xml',
          resource_type: 'documentreference',
          version_history: [],
        },
      };

      const result = prepareClinicalDocumentForVectorization(doc);

      // Should create multiple chunks
      expect(result.docList.length).toBeGreaterThan(1);

      // Each chunk should have proper metadata
      result.metaList.forEach((meta, index) => {
        expect(meta.documentId).toBe('doc-xml-large');
        expect(meta.chunkNumber).toBe(index);
        expect(meta.isFullDocument).toBe(false);
      });

      // Check chunk offsets and sizes
      result.docList.forEach((doc) => {
        if (doc.chunk) {
          expect(doc.chunk.offset).toBeDefined();
          expect(doc.chunk.size).toBeDefined();
          expect(doc.chunk.size).toBeGreaterThan(0);
        }
      });
    });

    it('does not chunk small XML documents', () => {
      const smallXmlContent = '<root>Small XML content</root>';
      const doc: ClinicalDocument<any> = {
        id: 'doc-xml-small',
        user_id: 'user-123',
        connection_record_id: 'conn-123',
        data_record: {
          raw: smallXmlContent,
          format: 'FHIR.DSTU2',
          content_type: 'application/xml',
          resource_type: 'documentreference',
          version_history: [],
        },
      };

      const result = prepareClinicalDocumentForVectorization(doc);

      expect(result.docList).toHaveLength(1);
      expect(result.docList[0].text).toContain('Small XML content');
      expect(result.metaList[0].chunkNumber).toBe(0);
    });
  });

  describe('metadata handling', () => {
    it('enriches chunks with proper metadata', () => {
      const doc: ClinicalDocument<any> = {
        id: 'doc-metadata',
        user_id: 'user-456',
        connection_record_id: 'conn-789',
        data_record: {
          raw: { test: 'metadata test' },
          format: 'FHIR.DSTU2',
          content_type: 'application/json',
          resource_type: 'diagnosticreport',
          version_history: [],
        },
        metadata: {
          id: 'http://example.com/doc',
          date: '2024-01-15',
          display_name: 'Metadata Test Doc',
        },
      };

      const result = prepareClinicalDocumentForVectorization(doc);

      const meta = result.metaList[0];
      expect(meta).toMatchObject({
        category: 'diagnosticreport',
        document_type: 'clinical_document',
        id: 'doc-metadata',
        url: 'http://example.com/doc',
        documentId: 'doc-metadata',
        user_id: 'user-456',
      });
    });

    it('handles missing metadata gracefully', () => {
      const doc: ClinicalDocument<any> = {
        id: 'doc-no-metadata',
        user_id: 'user-123',
        connection_record_id: 'conn-123',
        data_record: {
          raw: { test: 'no metadata' },
          format: 'FHIR.DSTU2',
          content_type: 'application/json',
          resource_type: 'condition',
          version_history: [],
        },
      };

      const result = prepareClinicalDocumentForVectorization(doc);

      expect(result.metaList[0].url).toBeUndefined();
      expect(result.metaList[0].documentId).toBe('doc-no-metadata');
      expect(result.metaList[0].category).toBe('condition');
    });
  });

  describe('unsupported content types', () => {
    it('returns empty arrays for unsupported content types', () => {
      const doc: ClinicalDocument<any> = {
        id: 'doc-unsupported',
        user_id: 'user-123',
        connection_record_id: 'conn-123',
        data_record: {
          raw: 'Plain text content',
          format: 'FHIR.DSTU2',
          content_type: 'text/plain',
          resource_type: 'documentreference',
          version_history: [],
        },
      };

      const result = prepareClinicalDocumentForVectorization(doc);

      expect(result.docList).toHaveLength(0);
      expect(result.metaList).toHaveLength(0);
    });
  });
});
