import { createTestClinicalDocument } from '../../../test-utils/clinicalDocumentTestData';
import { buildMedicationEntries } from './medications';

describe('buildMedicationEntries', () => {
  it('maps a medicationstatement by codeable concept text', () => {
    const doc = createTestClinicalDocument({
      id: 'conn-a|user-1|med-1',
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
    expect(buildMedicationEntries([doc])).toEqual([
      {
        type: 'medication',
        name: 'lisinopril 10 mg tablet',
        date: { kind: 'known', iso: '2025-02-01T00:00:00Z' },
        facts: [],
      },
    ]);
  });

  it('maps a DSTU2 medicationorder via the shared display helper', () => {
    const doc = createTestClinicalDocument({
      id: 'conn-a|user-1|med-2',
      data_record: {
        raw: {
          resource: {
            resourceType: 'MedicationOrder',
            medicationCodeableConcept: {
              coding: [{ display: 'atorvastatin 20 mg tablet' }],
            },
          },
        } as never,
        format: 'FHIR.DSTU2',
        content_type: 'application/json',
        resource_type: 'medicationorder',
        version_history: [],
      },
      metadata: { id: 'med-2', date: '2024-05-01T00:00:00Z' },
    });
    expect(buildMedicationEntries([doc])).toEqual([
      {
        type: 'medication',
        name: 'atorvastatin 20 mg tablet',
        date: { kind: 'known', iso: '2024-05-01T00:00:00Z' },
        facts: [],
      },
    ]);
  });
});
