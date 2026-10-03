import { createTestClinicalDocument } from '../../test-utils/clinicalDocumentTestData';
import { getMedicationOrderDisplayName } from './fhirAccessHelpers';

describe('getMedicationOrderDisplayName', () => {
  it('names a medication by its codeable concept text', () => {
    const doc = createTestClinicalDocument({
      data_record: {
        raw: {
          resource: {
            resourceType: 'MedicationStatement',
            medicationCodeableConcept: { text: 'lisinopril 10 mg tablet' },
          },
        } as never,
        format: 'FHIR.R4',
        content_type: 'application/json',
        resource_type: 'medicationstatement',
        version_history: [],
      },
      metadata: { id: 'med-1', date: '2025-02-01T00:00:00Z' },
    });
    expect(getMedicationOrderDisplayName(doc)).toEqual(
      'lisinopril 10 mg tablet',
    );
  });

  it('falls back to the medication reference display', () => {
    const doc = createTestClinicalDocument({
      data_record: {
        raw: {
          resource: {
            resourceType: 'MedicationStatement',
            medicationReference: {
              reference: 'Medication/m-1',
              display: 'metformin 500 mg tablet',
            },
          },
        } as never,
        format: 'FHIR.DSTU2',
        content_type: 'application/json',
        resource_type: 'medicationstatement',
        version_history: [],
      },
      metadata: { id: 'med-2', date: '2024-05-01T00:00:00Z' },
    });
    expect(getMedicationOrderDisplayName(doc)).toEqual(
      'metformin 500 mg tablet',
    );
  });
});
