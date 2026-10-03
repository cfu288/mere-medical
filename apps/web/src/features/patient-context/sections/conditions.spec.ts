import { createTestClinicalDocument } from '../../../test-utils/clinicalDocumentTestData';
import { buildConditionEntries } from './conditions';

describe('buildConditionEntries', () => {
  it('drops icd-10 Z00-Z13 examination codes and keeps uncoded and Z85 history entries', () => {
    const zCode = createTestClinicalDocument({
      id: 'conn-a|user-1|cond-z',
      data_record: {
        raw: {
          resource: {
            resourceType: 'Condition',
            code: {
              text: 'Encounter for annual physical exam',
              coding: [
                {
                  system: 'http://hl7.org/fhir/sid/icd-10-cm',
                  code: 'Z00.00',
                },
              ],
            },
          },
        } as never,
        format: 'FHIR.R4',
        content_type: 'application/json',
        resource_type: 'condition',
        version_history: [],
      },
      metadata: {
        id: 'cond-z',
        date: '2023-03-14T00:00:00Z',
        display_name: 'Encounter for annual physical exam',
      },
    });
    const screening = createTestClinicalDocument({
      id: 'conn-a|user-1|cond-s',
      data_record: {
        raw: {
          resource: {
            resourceType: 'Condition',
            code: { text: 'Screening for diabetes mellitus' },
          },
        } as never,
        format: 'FHIR.R4',
        content_type: 'application/json',
        resource_type: 'condition',
        version_history: [],
      },
      metadata: {
        id: 'cond-s',
        date: '2023-03-14T00:00:00Z',
        display_name: 'Screening for diabetes mellitus',
      },
    });
    const cancerHistory = createTestClinicalDocument({
      id: 'conn-a|user-1|cond-z85',
      data_record: {
        raw: {
          resource: {
            resourceType: 'Condition',
            code: {
              text: 'Personal history of malignant neoplasm of breast',
              coding: [
                {
                  system: 'http://hl7.org/fhir/sid/icd-10-cm',
                  code: 'Z85.3',
                },
              ],
            },
          },
        } as never,
        format: 'FHIR.R4',
        content_type: 'application/json',
        resource_type: 'condition',
        version_history: [],
      },
      metadata: {
        id: 'cond-z85',
        date: '2023-03-14T00:00:00Z',
        display_name: 'Personal history of malignant neoplasm of breast',
      },
    });
    expect(buildConditionEntries([zCode, screening, cancerHistory])).toEqual([
      {
        type: 'condition',
        name: 'Screening for diabetes mellitus',
        date: { kind: 'known', iso: '2023-03-14T00:00:00Z' },
        facts: [],
      },
      {
        type: 'condition',
        name: 'Personal history of malignant neoplasm of breast',
        date: { kind: 'known', iso: '2023-03-14T00:00:00Z' },
        facts: [],
      },
    ]);
  });

  it('maps an R4 condition with coded statuses', () => {
    const doc = createTestClinicalDocument({
      id: 'conn-a|user-1|cond-1',
      data_record: {
        raw: {
          resource: {
            resourceType: 'Condition',
            code: { text: 'Type 2 diabetes mellitus' },
            clinicalStatus: { coding: [{ code: 'active' }] },
            verificationStatus: { coding: [{ code: 'confirmed' }] },
          },
        } as never,
        format: 'FHIR.R4',
        content_type: 'application/json',
        resource_type: 'condition',
        version_history: [],
      },
      metadata: { id: 'cond-1', date: '2024-01-11T00:00:00Z' },
    });
    expect(buildConditionEntries([doc])).toEqual([
      {
        type: 'condition',
        name: 'Type 2 diabetes mellitus',
        date: { kind: 'known', iso: '2024-01-11T00:00:00Z' },
        facts: ['active/confirmed'],
      },
    ]);
  });

  it('maps DSTU2 plain string statuses', () => {
    const doc = createTestClinicalDocument({
      id: 'conn-a|user-1|cond-2',
      data_record: {
        raw: {
          resource: {
            resourceType: 'Condition',
            code: { text: 'Hypertension' },
            clinicalStatus: 'resolved',
          },
        } as never,
        format: 'FHIR.DSTU2',
        content_type: 'application/json',
        resource_type: 'condition',
        version_history: [],
      },
      metadata: { id: 'cond-2', date: '2020-03-01T00:00:00Z' },
    });
    expect(buildConditionEntries([doc])).toEqual([
      {
        type: 'condition',
        name: 'Hypertension',
        date: { kind: 'known', iso: '2020-03-01T00:00:00Z' },
        facts: ['resolved'],
      },
    ]);
  });
});
