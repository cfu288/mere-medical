import { BundleEntry, DiagnosticReport, Observation } from 'fhir/r2';
import { ClinicalDocument } from '../../../../models/clinical-document/ClinicalDocument.type';
import { prepareClinicalDocumentForVectorization } from './prepareClinicalDocumentForVectorization';

const testDRClinicalDocument: ClinicalDocument<BundleEntry<DiagnosticReport>> =
  {
    user_id: 'c3664aed-e146-4f24-b323-37da0f16069d',
    connection_record_id: '876128fe-21aa-4e14-a7f6-7f0491878356',
    data_record: {
      raw: {
        link: [
          {
            relation: 'self',
            url: 'https://mockhealthrecords.com/FHIR/api/FHIR/DSTU2/DiagnosticReport/MockReportID123',
          },
        ],
        fullUrl:
          'https://mockhealthrecords.com/FHIR/api/FHIR/DSTU2/DiagnosticReport/MockReportID123',
        resource: {
          resourceType: 'DiagnosticReport',
          id: 'MockReportID123',
          identifier: [
            {
              use: 'official',
              type: {
                coding: [
                  {
                    system: 'http://hl7.org/fhir/ValueSet/identifier-type',
                    code: 'PLAC',
                    display: 'Placer Identifier',
                  },
                ],
                text: 'Placer Identifier',
              },
              system: 'urn:oid:1.2.840.114350.1.13.621.2.7.2.798268',
              value: '98765432',
            },
            {
              use: 'usual',
              type: {
                coding: [
                  {
                    system: 'http.h1.org/fhir/ValueSet/identifier-type',
                    code: 'FILL',
                    display: 'Filler Identifier',
                  },
                ],
                text: 'Filler Identifier',
              },
              system:
                'urn:oid:1.2.840.114350.1.13.621.2.7.3.798268.320:application_id:MOCK-LAB',
              value: '123456789',
            },
            {
              use: 'usual',
              type: {
                coding: [
                  {
                    system: 'http://hl7.org/fhir/ValueSet/identifier-type',
                    code: 'FILL',
                    display: 'Filler Identifier',
                  },
                ],
                text: 'Filler Identifier',
              },
              system: 'urn:oid:1.2.840.114350.1.13.621.2.7.3.798268.800',
              value: '987654321',
            },
          ],
          status: 'final',
          category: {
            coding: [
              {
                system: 'urn:oid:1.2.840.114350.1.13.621.2.7.10.798268.30',
                code: 'Lab',
                display: 'Lab',
              },
            ],
            text: 'Lab',
          },
          code: {
            text: 'MockLab - BASIC METABOLIC PANEL - Final result',
          },
          subject: {
            display: 'Mock, John',
            reference:
              'https://mockhealthrecords.com/FHIR/api/FHIR/DSTU2/Patient/MockPatientID789',
          },
          effectiveDateTime: '2023-07-01T08:30:00Z',
          issued: '2023-07-02T12:45:00Z',
          performer: {
            display: 'Dr. Mockington',
            reference:
              'https://mockhealthrecords.com/FHIR/api/FHIR/DSTU2/Practitioner/MockPractitionerID456',
          },
          result: [
            {
              display: 'Component: LC- GLUCOSE',
              reference:
                'https://mockhealthrecords.com/FHIR/api/FHIR/DSTU2/Observation/MockObsID1',
            },
            {
              display: 'Component: LC- BUN',
              reference:
                'https://mockhealthrecords.com/FHIR/api/FHIR/DSTU2/Observation/MockObsID2',
            },
            {
              display: 'Component: LC- CREATININE',
              reference:
                'https://mockhealthrecords.com/FHIR/api/FHIR/DSTU2/Observation/MockObsID3',
            },
            {
              display: 'Component: Mock E-GFR',
              reference:
                'https://mockhealthrecords.com/FHIR/api/FHIR/DSTU2/Observation/MockObsID4',
            },
            {
              display: 'Component: LC- BUN/CREAT RATIO',
              reference:
                'https://mockhealthrecords.com/FHIR/api/FHIR/DSTU2/Observation/MockObsID5',
            },
            {
              display: 'Component: Mock SODIUM',
              reference:
                'https://mockhealthrecords.com/FHIR/api/FHIR/DSTU2/Observation/MockObsID6',
            },
            {
              display: 'Component: LC- POTASSIUM',
              reference:
                'https://mockhealthrecords.com/FHIR/api/FHIR/DSTU2/Observation/MockObsID7',
            },
            {
              display: 'Component: LC- CHLORIDE',
              reference:
                'https://mockhealthrecords.com/FHIR/api/FHIR/DSTU2/Observation/MockObsID8',
            },
            {
              display: 'Component: LC- CARBON DIOXIDE',
              reference:
                'https://mockhealthrecords.com/FHIR/api/FHIR/DSTU2/Observation/MockObsID9',
            },
            {
              display: 'Component: LC- CALCIUM',
              reference:
                'https://mockhealthrecords.com/FHIR/api/FHIR/DSTU2/Observation/MockObsID10',
            },
          ],
        },
        search: { mode: 'match' },
      },
      format: 'FHIR.DSTU2',
      content_type: 'application/json',
      resource_type: 'diagnosticreport',
      version_history: [],
    },
    metadata: {
      id: 'https://www.example.com',
      date: '2023-03-14T16:48:00Z',
      display_name: 'HEMOGLOBIN A1C - Final result',
    },
    id: '876128fe-21aa-4e14-a7f6-7f0491878356|c3664aed-e146-4f24-b323-37da0f16069d|https://www.example.com',
  };

const textObsClinicalDocument: ClinicalDocument<BundleEntry<Observation>> = {
  id: '876128fe-21aa-4e14-a7f6-7f0491878356|c3664aed-e146-4f24-b323-37da0f16069d|https://www.example.com',
  user_id: 'c3664aed-e146-4f24-b323-37da0f16069d',
  connection_record_id: '876128fe-21aa-4e14-a7f6-7f0491878356',
  data_record: {
    raw: {
      link: [
        {
          relation: 'self',
          url: 'https://fhir.healthcare.org/api/FHIR/DSTU2/Observation/12345ABCDEF',
        },
      ],
      fullUrl:
        'https://fhir.healthcare.org/api/FHIR/DSTU2/Observation/12345ABCDEF',
      resource: {
        resourceType: 'Observation',
        id: '12345ABCDEF',
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
              code: '84295-9',
              display: 'Glucose level in Blood',
            },
          ],
          text: 'GLUCOSE (LABCORP)',
        },
        subject: {
          display: 'Doe, John',
          reference:
            'https://fhir.healthcare.org/api/FHIR/DSTU2/Patient/67890XYZ',
        },
        effectiveDateTime: '2023-01-01T07:30:00Z',
        issued: '2010-01-01T09:00:00Z',
        valueQuantity: {
          value: 5.6,
          unit: 'mmol/L',
          system: 'http://unitsofmeasure.org',
          code: 'mmol/L',
        },
        referenceRange: [
          {
            low: {
              value: 3.9,
              unit: 'mmol/L',
              system: 'http://unitsofmeasure.org',
              code: 'mmol/L',
            },
            high: {
              value: 6.1,
              unit: 'mmol/L',
              system: 'http://unitsofmeasure.org',
              code: 'mmol/L',
            },
            text: '3.9 - 6.1 mmol/L',
          },
        ],
      },
      search: { mode: 'match' },
    },
    format: 'FHIR.DSTU2',
    content_type: 'application/json',
    resource_type: 'observation',
    version_history: [],
  },
  metadata: {
    id: 'https://www.example.com',
    date: '2023-03-14T16:48:00Z',
    display_name: 'SODIUM (QUEST)',
  },
};

describe('VectorStorageProvider', () => {
  describe('prepareClinicalDocumentForVectorization can serialize DR', () => {
    it('can serialize a DiagnosticReport correctly', async () => {
      const result = await prepareClinicalDocumentForVectorization(
        testDRClinicalDocument,
      );
      expect(result.docList).toHaveLength(1);
      expect(result.docList[0].id).toBe(
        '876128fe-21aa-4e14-a7f6-7f0491878356|c3664aed-e146-4f24-b323-37da0f16069d|https://www.example.com',
      );
      expect(result.docList[0].text).toBe(
        'DiagnosticReport|MockLab - BASIC METABOLIC PANEL - Final result|2023-07-01T08:30:00Z|2023-07-02T12:45:00Z|Dr. Mockington|https://mockhealthrecords.com/FHIR/api/FHIR/DSTU2/Practitioner/MockPractitionerID456|Component: LC- GLUCOSE|https://mockhealthrecords.com/FHIR/api/FHIR/DSTU2/Observation/MockObsID1|Component: LC- BUN|https://mockhealthrecords.com/FHIR/api/FHIR/DSTU2/Observation/MockObsID2|Component: LC- CREATININE|https://mockhealthrecords.com/FHIR/api/FHIR/DSTU2/Observation/MockObsID3|Component: Mock E-GFR|https://mockhealthrecords.com/FHIR/api/FHIR/DSTU2/Observation/MockObsID4|Component: LC- BUN/CREAT RATIO|https://mockhealthrecords.com/FHIR/api/FHIR/DSTU2/Observation/MockObsID5|Component: Mock SODIUM|https://mockhealthrecords.com/FHIR/api/FHIR/DSTU2/Observation/MockObsID6|Component: LC- POTASSIUM|https://mockhealthrecords.com/FHIR/api/FHIR/DSTU2/Observation/MockObsID7|Component: LC- CHLORIDE|https://mockhealthrecords.com/FHIR/api/FHIR/DSTU2/Observation/MockObsID8|Component: LC- CARBON DIOXIDE|https://mockhealthrecords.com/FHIR/api/FHIR/DSTU2/Observation/MockObsID9|Component: LC- CALCIUM|https://mockhealthrecords.com/FHIR/api/FHIR/DSTU2/Observation/MockObsID10',
      );
      expect(result.metaList).toHaveLength(1);
      expect(result.metaList[0].id).toBe(
        '876128fe-21aa-4e14-a7f6-7f0491878356|c3664aed-e146-4f24-b323-37da0f16069d|https://www.example.com',
      );
      expect(result.metaList[0].document_type).toBe('clinical_document');
      expect(result.metaList[0].category).toBe('diagnosticreport');
      expect(result.metaList[0].url).toBe('https://www.example.com');
    });
  });

  describe('prepareClinicalDocumentForVectorization can serialize Observation', () => {
    it('can serialize a Observation correctly', async () => {
      const result = await prepareClinicalDocumentForVectorization(
        textObsClinicalDocument,
      );
      expect(result.docList).toHaveLength(1);
      expect(result.docList[0].id).toBe(
        '876128fe-21aa-4e14-a7f6-7f0491878356|c3664aed-e146-4f24-b323-37da0f16069d|https://www.example.com',
      );
      expect(result.docList[0].text).toBe(
        'Observation|http://loinc.org|84295-9|Glucose level in Blood|GLUCOSE (LABCORP)|2023-01-01T07:30:00Z|2010-01-01T09:00:00Z|5.6|mmol/L|http://unitsofmeasure.org|3.9|6.1|3.9 - 6.1 mmol/L',
      );
      expect(result.metaList).toHaveLength(1);
      expect(result.metaList[0].id).toBe(
        '876128fe-21aa-4e14-a7f6-7f0491878356|c3664aed-e146-4f24-b323-37da0f16069d|https://www.example.com',
      );
      expect(result.metaList[0].document_type).toBe('clinical_document');
      expect(result.metaList[0].category).toBe('observation');
      expect(result.metaList[0].url).toBe('https://www.example.com');
    });
  });
});
