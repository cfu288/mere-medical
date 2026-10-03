import { createTestClinicalDocument } from '../../../test-utils/clinicalDocumentTestData';
import { buildEncounterEntries } from './encounters';

describe('buildEncounterEntries', () => {
  it('maps an R4 encounter with reasonCode', () => {
    const doc = createTestClinicalDocument({
      id: 'conn-a|user-1|enc-1',
      data_record: {
        raw: {
          resource: {
            resourceType: 'Encounter',
            period: { start: '2025-11-04T09:00:00Z' },
            type: [{ text: 'Office Visit' }],
            participant: [{ individual: { display: 'Dr. A. Smith' } }],
            serviceProvider: { display: 'UW Medicine' },
            reasonCode: [{ text: 'knee pain' }],
          },
        } as never,
        format: 'FHIR.R4',
        content_type: 'application/json',
        resource_type: 'encounter',
        version_history: [],
      },
      metadata: { id: 'enc-1', date: '2025-11-04T09:00:00Z' },
    });
    expect(buildEncounterEntries([doc])).toEqual([
      {
        type: 'encounter',
        name: 'Office Visit',
        date: { kind: 'known', iso: '2025-11-04T09:00:00Z' },
        facts: ['Dr. A. Smith', 'UW Medicine', 'knee pain'],
      },
    ]);
  });

  it('maps a DSTU2 encounter reason and string class', () => {
    const doc = createTestClinicalDocument({
      id: 'conn-a|user-1|enc-2',
      data_record: {
        raw: {
          resource: {
            resourceType: 'Encounter',
            class: 'ambulatory',
            period: { start: '2024-06-01T08:00:00Z' },
            reason: [{ coding: [{ display: 'annual physical' }] }],
            location: [{ location: { display: 'Blessings Clinic' } }],
          },
        } as never,
        format: 'FHIR.DSTU2',
        content_type: 'application/json',
        resource_type: 'encounter',
        version_history: [],
      },
      metadata: { id: 'enc-2', date: '2024-06-01T08:00:00Z' },
    });
    expect(buildEncounterEntries([doc])).toEqual([
      {
        type: 'encounter',
        name: 'ambulatory',
        date: { kind: 'known', iso: '2024-06-01T08:00:00Z' },
        facts: ['Blessings Clinic', 'annual physical'],
      },
    ]);
  });
});
